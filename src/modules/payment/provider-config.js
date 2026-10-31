export const isProviderConfigured = (provider) => {
    switch (String(provider || "").toLowerCase()) {
        case "kunnect":
            return Boolean(
                process.env.KUNNECT_APP_KEY &&
                process.env.KUNNECT_SECRET_KEY &&
                process.env.KUNNECT_MERCHANT_ACCOUNT_ID &&
                process.env.KUNNECT_BASE_URL
            );
        case "stripe":
        case "antom":
            return false;
        default:
            return false;
    }
};
