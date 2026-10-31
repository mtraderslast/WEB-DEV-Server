export const PAYMENT_PROVIDERS = {
    KUNNECT: "kunnect",
    STRIPE: "stripe",
    ANTOM: "antom",
};

export const PROVIDER_LIST = Object.values(PAYMENT_PROVIDERS);

export const PAYMENT_STATUS = {
    PENDING: "PENDING",
    PAID: "PAID",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
};

export const ORDER_TYPES = {
    PACKAGE_ORDER: "PACKAGE_ORDER",
    ADVANCE_PAYMENT: "ADVANCE_PAYMENT",
};
