import axios from "axios";
import AppError from "../../../../utils/AppError.js";

export const normalizeKunnectBaseUrl = (baseUrl = "") => {
    let clean = String(baseUrl).trim().replace(/\/$/, "");
    if (!clean) return "";
    if (!/^https?:\/\//i.test(clean)) {
        clean = `https://${clean}`;
    }
    return clean.replace(/\/api\/v1$/i, "");
};

export const getKunnectCredentials = (gateway = {}) => {
    const stored = gateway.credentials || {};

    return {
        appKey: process.env.KUNNECT_APP_KEY || stored.appKey,
        secretKey: process.env.KUNNECT_SECRET_KEY || stored.secretKey,
        merchantAccountId: String(
            process.env.KUNNECT_MERCHANT_ACCOUNT_ID || stored.merchantAccountId || ""
        ),
        baseUrl: normalizeKunnectBaseUrl(process.env.KUNNECT_BASE_URL || stored.baseUrl || ""),
    };
};

export const isPublicHttpsUrl = (url = "") => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname);
    } catch {
        return false;
    }
};

export const getKunnectWebhookUrl = () => {
    if (isPublicHttpsUrl(process.env.KUNNECT_WEBHOOK_URL)) {
        return process.env.KUNNECT_WEBHOOK_URL;
    }

    const backendUrl = process.env.BETTER_AUTH_URL || "";
    const fallback = `${String(backendUrl).replace(/\/$/, "")}/api/webhooks/kunnect`;
    return isPublicHttpsUrl(fallback) ? fallback : "";
};

export const assertKunnectCredentials = (creds) => {
    if (!creds.appKey || !creds.secretKey || !creds.merchantAccountId || !creds.baseUrl) {
        throw new AppError(500, "Kunnect credentials are not configured in .env");
    }
};

export const kunnectRequest = async ({ gateway, method = "GET", path, data, params }) => {
    const creds = getKunnectCredentials(gateway);
    assertKunnectCredentials(creds);

    try {
        const response = await axios({
            method,
            url: `${creds.baseUrl}${path}`,
            data,
            params,
            auth: {
                username: creds.appKey,
                password: creds.secretKey,
            },
            headers: { "Content-Type": "application/json" },
            timeout: 20000,
        });
        return response.data;
    } catch (error) {
        const details = error.response?.data;
        const validation = details?.errors
            ? Object.entries(details.errors)
                .map(([field, messages]) => `${field}: ${[].concat(messages).join(", ")}`)
                .join("; ")
            : "";

        throw new AppError(
            502,
            validation ||
            details?.message ||
            details?.error ||
            error.message ||
            "Kunnect request failed"
        );
    }
};
