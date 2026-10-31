import mongoose from "mongoose";
import { PROVIDER_LIST } from "../payment/payment.constants.js";

const gatewaySchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            enum: PROVIDER_LIST,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        currency: {
            type: String,
            default: "USD",
            uppercase: true,
            trim: true,
        },
        credentials: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
        versionKey: false,
        strict: false,
    }
);

gatewaySchema.index({ isActive: 1 });

const Gateway = mongoose.model("Gateway", gatewaySchema);

export const ensureGatewayIndexes = async () => {
    try {
        const indexes = await Gateway.collection.indexes();
        const stale = indexes.filter((index) => {
            const keys = Object.keys(index.key || {});
            return index.name !== "_id_" && (keys.includes("name") || keys.includes("priority"));
        });

        for (const index of stale) {
            await Gateway.collection.dropIndex(index.name);
            console.log(`[Gateway] Dropped stale index: ${index.name}`);
        }

        const docs = await Gateway.find({});
        for (const doc of docs) {
            const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
            const raw = String(plain.provider || plain.name || "").toLowerCase().trim();
            if (!raw || !PROVIDER_LIST.includes(raw)) continue;
            if (plain.provider === raw && plain.displayName) continue;

            await Gateway.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        provider: raw,
                        displayName: doc.displayName || raw.toUpperCase(),
                    },
                }
            );
        }
    } catch (error) {
        console.warn("[Gateway] Index cleanup skipped:", error.message);
    }
};

export default Gateway;
