import crypto from "node:crypto";
import { getKunnectCredentials } from "./kunnect.client.js";

const SIGNATURE_HEADERS = [
    "x-signature",
    "x-kunnect-signature",
    "x-paymid-signature",
    "x-hmac-sha256",
    "signature",
];

const sortValue = (value) => {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }

    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                acc[key] = sortValue(value[key]);
                return acc;
            }, {});
    }

    return value;
};

export const buildKunnectSignature = (payload, secretKey) => {
    const compactJson = JSON.stringify(sortValue(payload || {}));
    return crypto.createHmac("sha256", secretKey).update(compactJson).digest("hex");
};

const getProvidedSignature = (req) => {
    for (const header of SIGNATURE_HEADERS) {
        const value = req.headers?.[header];
        if (value) {
            return String(value).trim().replace(/^sha256=/i, "");
        }
    }
    return "";
};

const signaturesMatch = (provided, expectedHex, secretKey, payload) => {
    const expectedBase64 = crypto
        .createHmac("sha256", secretKey)
        .update(JSON.stringify(sortValue(payload || {})))
        .digest("base64");

    const candidates = [expectedHex, expectedBase64];

    return candidates.some((expected) => {
        const left = Buffer.from(provided);
        const right = Buffer.from(expected);
        if (left.length !== right.length) return false;
        return crypto.timingSafeEqual(left, right);
    });
};

export const verifyKunnectWebhookSignature = (req, gateway) => {
    const provided = getProvidedSignature(req);
    if (!provided) return false;

    const { secretKey } = getKunnectCredentials(gateway);
    if (!secretKey) return false;

    const expectedHex = buildKunnectSignature(req.body, secretKey);
    return signaturesMatch(provided, expectedHex, secretKey, req.body);
};
