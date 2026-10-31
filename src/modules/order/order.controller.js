import crypto from "node:crypto";
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/AppError.js";
import Service from "../services/services.model.js";
import { ORDER_TYPES, PAYMENT_STATUS } from "../payment/payment.constants.js";
import {
    createCheckoutSession,
    getActiveGateway,
    refreshPendingOrder,
    validateProviderBilling,
} from "../payment/payment.service.js";
import Order from "./order.model.js";

const splitName = (fullName = "") => {
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: "", lastName: "" };
    return {
        firstName: parts[0],
        lastName: parts.length > 1 ? parts.slice(1).join(" ") : parts[0],
    };
};

const normalizeBilling = (body = {}) => {
    const billing = { ...(body.billing || {}) };

    if (!billing.email && body.email) billing.email = body.email;
    if (!billing.contactNumber && (body.phone || body.contactNumber)) {
        billing.contactNumber = body.phone || body.contactNumber;
    }

    if ((!billing.firstName || !billing.lastName) && body.name) {
        const parts = splitName(body.name);
        billing.firstName = billing.firstName || parts.firstName;
        billing.lastName = billing.lastName || parts.lastName;
    }

    ["address", "country", "state", "city", "zipCode", "dob", "middleName"].forEach((field) => {
        if ((billing[field] === undefined || billing[field] === "") && body[field] != null) {
            billing[field] = body[field];
        }
    });

    if (!billing.state) billing.state = "N/A";

    return billing;
};

const resolvePackageOrder = async (packageDetails = {}) => {
    const { slug, tier } = packageDetails;

    if (!slug || !tier) {
        throw new AppError(400, "Package slug and tier are required");
    }

    const service = await Service.findOne({ slug });
    if (!service) {
        throw new AppError(404, "Service not found");
    }

    const selectedPackage = service.packages.find((item) => item.tier === tier);
    if (!selectedPackage) {
        throw new AppError(404, "Package tier not found");
    }

    if (!selectedPackage.price || selectedPackage.price <= 0) {
        throw new AppError(400, "Package price is invalid");
    }

    return {
        amount: selectedPackage.price,
        packageDetails: {
            slug: service.slug,
            tier: selectedPackage.tier,
            title: selectedPackage.title,
        },
    };
};

export const createPaymentSession = catchAsync(async (req, res) => {
    const { orderType, customPurpose } = req.body;
    const billing = normalizeBilling(req.body);

    if (!orderType || !Object.values(ORDER_TYPES).includes(orderType)) {
        throw new AppError(400, "A valid orderType is required");
    }

    const gateway = await getActiveGateway();
    validateProviderBilling(gateway.provider, billing);

    let amount;
    let packageDetails;

    if (orderType === ORDER_TYPES.PACKAGE_ORDER) {
        const resolved = await resolvePackageOrder(req.body.packageDetails || {});
        amount = resolved.amount;
        packageDetails = resolved.packageDetails;
    } else {
        amount = Number(req.body.amount);
        if (!amount || amount <= 0) {
            throw new AppError(400, "A valid amount is required for advance payment");
        }
        packageDetails = req.body.packageDetails;
    }

    const customerName = `${billing.firstName} ${billing.lastName}`.trim();
    const newOrder = await Order.create({
        customerInfo: {
            name: customerName,
            email: billing.email,
        },
        billing,
        orderType,
        packageDetails,
        customPurpose,
        amount,
        currency: gateway.currency || "USD",
        paymentStatus: PAYMENT_STATUS.PENDING,
        gatewayId: gateway._id,
        provider: gateway.provider,
        webhookToken: crypto.randomBytes(24).toString("hex"),
    });

    try {
        const paymentDetails = await createCheckoutSession(newOrder, gateway);

        newOrder.providerReference = paymentDetails.providerReference;
        await newOrder.save();

        res.status(200).json({
            success: true,
            message: "Order created successfully",
            checkoutUrl: paymentDetails.checkoutUrl,
            orderId: newOrder._id,
            gatewayUsed: gateway.provider,
        });
    } catch (error) {
        newOrder.paymentStatus = PAYMENT_STATUS.FAILED;
        await newOrder.save();
        throw error;
    }
});

export const getOrderPaymentStatus = catchAsync(async (req, res) => {
    const order = await Order.findById(req.params.orderId).select(
        "paymentStatus provider amount currency gatewayId providerReference"
    );

    if (!order) {
        throw new AppError(404, "Order not found");
    }

    let current = order;
    if (order.paymentStatus === PAYMENT_STATUS.PENDING) {
        try {
            current = await refreshPendingOrder(order);
        } catch (error) {
            console.error("Payment status refresh failed:", error.message);
        }
    }

    res.status(200).json({
        success: true,
        data: {
            orderId: current._id,
            paymentStatus: current.paymentStatus,
        },
    });
});
