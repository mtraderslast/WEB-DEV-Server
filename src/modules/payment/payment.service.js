import mongoose from "mongoose";
import AppError from "../../utils/AppError.js";
import Gateway from "../gateway/gateway.model.js";
import Order from "../order/order.model.js";
import { PAYMENT_STATUS } from "./payment.constants.js";
import { getProvider } from "./providers/index.js";

const PAID_STATUSES = new Set([
    "success",
    "successful",
    "paid",
    "completed",
    "complete",
    "captured",
    "approved",
    "accepted",
]);

const FAILED_STATUSES = new Set([
    "failed",
    "failure",
    "declined",
    "error",
    "rejected",
]);

const CANCELLED_STATUSES = new Set([
    "cancelled",
    "canceled",
    "expired",
    "void",
    "refunded",
]);

export const getActiveGateway = async () => {
    const gateway = await Gateway.findOne({ isActive: true });

    if (!gateway) {
        throw new AppError(400, "No payment gateway is active. Ask admin to activate one.");
    }

    return gateway;
};

export const validateProviderBilling = (providerName, billing = {}) => {
    const provider = getProvider(providerName);
    const requiredFields = provider.requiredBillingFields || [];
    const missing = requiredFields.filter((field) => {
        const value = billing[field];
        return value === undefined || value === null || String(value).trim() === "";
    });

    if (missing.length) {
        throw new AppError(400, `Missing billing fields for ${providerName}: ${missing.join(", ")}`);
    }
};

export const createCheckoutSession = async (order, gateway) => {
    const provider = getProvider(gateway.provider);
    return provider.createCheckout({ order, gateway });
};

export const findOrderByReference = async (reference) => {
    if (!reference) return null;

    const ref = String(reference);
    const filters = [{ providerReference: ref }];

    if (mongoose.Types.ObjectId.isValid(ref) && new mongoose.Types.ObjectId(ref).toString() === ref) {
        filters.push({ _id: ref });
    }

    return Order.findOne({ $or: filters });
};

export const mapProviderStatus = (rawStatus) => {
    const status = String(rawStatus || "").toLowerCase().trim();
    if (!status) return null;
    if (status.includes("no transaction")) return null;
    if (status === "pending") return null;
    if (PAID_STATUSES.has(status)) return PAYMENT_STATUS.PAID;
    if (FAILED_STATUSES.has(status)) return PAYMENT_STATUS.FAILED;
    if (CANCELLED_STATUSES.has(status)) return PAYMENT_STATUS.CANCELLED;
    return null;
};

export const applyPaymentResult = async ({ reference, status, transactionId }) => {
    const order = await findOrderByReference(reference);

    if (!order) {
        throw new AppError(404, "Order not found for this payment reference");
    }

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
        return order;
    }

    const nextStatus = mapProviderStatus(status);
    if (!nextStatus) {
        return order;
    }

    order.paymentStatus = nextStatus;
    if (transactionId) {
        order.transactionId = String(transactionId);
    }
    if (nextStatus === PAYMENT_STATUS.PAID) {
        order.paidAt = new Date();
    }

    await order.save();
    return order;
};

export const refreshPendingOrder = async (order) => {
    if (!order || order.paymentStatus !== PAYMENT_STATUS.PENDING) {
        return order;
    }

    const provider = getProvider(order.provider);
    if (!provider.fetchPaymentStatus) {
        return order;
    }

    const gateway = order.gatewayId
        ? await Gateway.findById(order.gatewayId)
        : await getActiveGateway();

    const result = await provider.fetchPaymentStatus({ order, gateway });
    return applyPaymentResult({
        reference: String(order._id),
        status: result.status,
        transactionId: result.transactionId,
    });
};
