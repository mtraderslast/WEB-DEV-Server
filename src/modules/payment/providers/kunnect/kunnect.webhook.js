import catchAsync from "../../../../utils/catchAsync.js";
import AppError from "../../../../utils/AppError.js";
import { applyPaymentResult } from "../../payment.service.js";
import { verifyKunnectWebhookSignature } from "./kunnect.signature.js";

const pickFirst = (payload, keys) => {
    for (const key of keys) {
        if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
            return payload[key];
        }
    }
    return undefined;
};

export const handleKunnectWebhook = catchAsync(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const nestedData = body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? body.data
        : {};

    const payload = {
        ...(req.query || {}),
        ...body,
        ...nestedData,
    };

    const eventType = String(pickFirst(payload, ["type"]) || "sale").toLowerCase();
    const reference = pickFirst(payload, [
        "reference",
        "orderId",
        "order_id",
        "merchantReference",
        "merchant_reference",
    ]);
    const status = pickFirst(payload, [
        "status",
        "paymentStatus",
        "payment_status",
        "transactionStatus",
        "transaction_status",
    ]);
    const transactionId = pickFirst(payload, [
        "transaction_id",
        "transactionId",
        "txnId",
        "txn_id",
    ]);

    if (!reference) {
        return res.status(400).json({
            success: false,
            message: "Kunnect webhook reference is missing",
        });
    }

    if (eventType === "refund" || eventType === "payout") {
        return res.status(200).json({
            success: true,
            message: `Ignored ${eventType} webhook`,
        });
    }

    const signatureValid = verifyKunnectWebhookSignature(req, {});
    const hasSignatureHeader = [
        "x-signature",
        "x-kunnect-signature",
        "x-paymid-signature",
        "x-hmac-sha256",
        "signature",
    ].some((header) => req.headers?.[header]);

    if (hasSignatureHeader && !signatureValid) {
        throw new AppError(401, "Invalid Kunnect webhook signature");
    }

    const order = await applyPaymentResult({
        reference,
        status,
        transactionId,
    });

    res.status(200).json({
        success: true,
        message: "Webhook processed",
        data: {
            orderId: order._id,
            paymentStatus: order.paymentStatus,
        },
    });
});
