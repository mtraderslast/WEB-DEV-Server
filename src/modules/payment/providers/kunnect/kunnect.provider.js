import AppError from "../../../../utils/AppError.js";
import {
    assertKunnectCredentials,
    getKunnectCredentials,
    getKunnectWebhookUrl,
    kunnectRequest,
} from "./kunnect.client.js";

export const requiredBillingFields = [
    "firstName",
    "lastName",
    "email",
    "contactNumber",
    "address",
    "country",
    "state",
    "city",
    "zipCode",
];

const toZipCode = (value) => {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
};

export const createCheckout = async ({ order, gateway }) => {
    const creds = getKunnectCredentials(gateway);
    assertKunnectCredentials(creds);

    const billing = order.billing || {};
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const webhookUrl = getKunnectWebhookUrl();
    const reference = String(order._id);

    const payload = {
        firstName: billing.firstName,
        lastName: billing.lastName,
        reference,
        email: billing.email,
        contactNumber: billing.contactNumber,
        address: billing.address,
        country: billing.country,
        state: billing.state || "N/A",
        city: billing.city,
        zipCode: toZipCode(billing.zipCode),
        currency: order.currency || gateway.currency || "USD",
        amount: Number(order.amount),
        merchantAccountId: creds.merchantAccountId,
        ttl: 30,
        successUrl: `${frontendUrl}/payment-success?orderId={reference_id}`,
        failedUrl: `${frontendUrl}/payment-cancelled?orderId={reference_id}`,
        tagName: order.packageDetails?.title || order.orderType,
    };

    if (webhookUrl) {
        payload.webhookUrl = webhookUrl;
    }

    if (billing.middleName) payload.middleName = billing.middleName;
    if (billing.dob) payload.dob = billing.dob;

    const response = await kunnectRequest({
        gateway,
        method: "POST",
        path: "/api/v1/payment/request",
        data: payload,
    });

    const paymentUrl = response?.data?.payment_url;
    if (!response?.success || !paymentUrl) {
        throw new AppError(502, response?.message || "Kunnect did not return a payment URL");
    }

    return {
        checkoutUrl: paymentUrl,
        providerReference: response?.data?.reference || reference,
    };
};

export const fetchPaymentStatus = async ({ order, gateway }) => {
    const creds = getKunnectCredentials(gateway);
    assertKunnectCredentials(creds);

    const response = await kunnectRequest({
        gateway,
        method: "GET",
        path: "/api/v1/payment/request-status",
        params: {
            reference: order.providerReference || String(order._id),
            merchantAccountId: creds.merchantAccountId,
        },
    });

    const data = response?.data && typeof response.data === "object" ? response.data : {};
    const status = data.status || data.paymentStatus || response?.status || response?.message;

    return {
        status,
        transactionId: data.transaction_id || data.transactionId,
        raw: response,
    };
};
