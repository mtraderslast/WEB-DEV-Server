import AppError from "../../../utils/AppError.js";
import * as kunnect from "./kunnect/kunnect.provider.js";

/**
 * Add a new gateway by creating providers/<name>/ and registering it here.
 * Webhook route also needs one line in payment.webhook.route.js.
 */
const providers = {
    kunnect,
};

export const listIntegratedProviders = () => Object.keys(providers);

export const getProvider = (name) => {
    const key = String(name || "").toLowerCase();
    const provider = providers[key];

    if (!provider?.createCheckout) {
        throw new AppError(400, `Payment provider "${name}" is not integrated yet`);
    }

    return provider;
};
