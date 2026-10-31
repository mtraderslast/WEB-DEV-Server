import mongoose from "mongoose";
import catchAsync from "../../utils/catchAsync.js";
import AppError from "../../utils/AppError.js";
import { PROVIDER_LIST } from "../payment/payment.constants.js";
import { isProviderConfigured } from "../payment/provider-config.js";
import { listIntegratedProviders } from "../payment/providers/index.js";
import Gateway from "./gateway.model.js";

const toPublicGateway = (gateway) => {
    if (!gateway) return null;
    const data = typeof gateway.toObject === "function" ? gateway.toObject() : { ...gateway };
    const provider = String(data.provider || data.name || "").toLowerCase();

    return {
        _id: data._id,
        provider,
        displayName: data.displayName || data.name || provider.toUpperCase(),
        isActive: Boolean(data.isActive),
        currency: data.currency || "USD",
        hasCredentials: isProviderConfigured(provider),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

const activateExclusive = async (gatewayId) => {
    await Gateway.updateMany({ _id: { $ne: gatewayId } }, { $set: { isActive: false } });
    return Gateway.findByIdAndUpdate(
        gatewayId,
        { $set: { isActive: true } },
        { new: true, runValidators: false }
    );
};

export const getProviderCatalog = catchAsync(async (req, res) => {
    const integrated = listIntegratedProviders();

    res.status(200).json({
        success: true,
        message: "Payment providers retrieved successfully",
        data: PROVIDER_LIST.map((provider) => ({
            provider,
            integrated: integrated.includes(provider),
            hasCredentials: isProviderConfigured(provider),
        })),
    });
});

export const getGateways = catchAsync(async (req, res) => {
    const gateways = await Gateway.find().sort({ createdAt: 1 });

    res.status(200).json({
        success: true,
        message: "Gateways retrieved successfully",
        data: gateways.map(toPublicGateway).filter(Boolean),
    });
});

export const createGateway = catchAsync(async (req, res) => {
    const { provider, name, displayName, currency, isActive } = req.body;
    const rawProvider = provider || name;

    if (!rawProvider) {
        throw new AppError(400, "Gateway provider is required");
    }

    const normalizedProvider = String(rawProvider).toLowerCase().trim();
    if (!PROVIDER_LIST.includes(normalizedProvider)) {
        throw new AppError(400, `Unsupported provider. Allowed: ${PROVIDER_LIST.join(", ")}`);
    }

    const exists = await Gateway.findOne({ provider: normalizedProvider });
    if (exists) {
        throw new AppError(409, `${normalizedProvider} is already added`);
    }

    const count = await Gateway.countDocuments();

    try {
        const gateway = await Gateway.create({
            provider: normalizedProvider,
            displayName: displayName || normalizedProvider.toUpperCase(),
            currency: currency || "USD",
            credentials: {},
            isActive: false,
        });

        const shouldActivate = isActive === true || count === 0;
        const saved = shouldActivate ? await activateExclusive(gateway._id) : gateway;

        res.status(201).json({
            success: true,
            message: "Gateway created successfully",
            data: toPublicGateway(saved),
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw new AppError(409, "This payment gateway is already added");
        }
        throw error;
    }
});

export const updateGateway = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { displayName, currency, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(400, "Invalid gateway id");
    }

    const gateway = await Gateway.findById(id);
    if (!gateway) {
        throw new AppError(404, "Gateway not found");
    }

    const updates = {};
    if (typeof displayName === "string" && displayName.trim()) {
        updates.displayName = displayName.trim();
    }
    if (typeof currency === "string" && currency.trim()) {
        updates.currency = currency.trim().toUpperCase();
    }

    let saved;
    if (isActive === true) {
        saved = await activateExclusive(gateway._id);
        if (Object.keys(updates).length) {
            saved = await Gateway.findByIdAndUpdate(gateway._id, { $set: updates }, { new: true, runValidators: false });
        }
    } else {
        if (isActive === false) {
            updates.isActive = false;
        }
        saved = await Gateway.findByIdAndUpdate(
            gateway._id,
            { $set: updates },
            { new: true, runValidators: false }
        );
    }

    res.status(200).json({
        success: true,
        message: "Gateway updated successfully",
        data: toPublicGateway(saved),
    });
});
