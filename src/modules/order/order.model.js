import mongoose from "mongoose";
import { ORDER_TYPES, PAYMENT_STATUS, PROVIDER_LIST } from "../payment/payment.constants.js";

const billingSchema = new mongoose.Schema(
    {
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        middleName: { type: String, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        contactNumber: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        country: { type: String, required: true, trim: true },
        state: { type: String, default: "N/A", trim: true },
        city: { type: String, required: true, trim: true },
        zipCode: { type: String, required: true, trim: true },
        dob: { type: String, trim: true },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        customerInfo: {
            name: { type: String, required: true, trim: true },
            email: { type: String, required: true, trim: true, lowercase: true },
        },
        billing: {
            type: billingSchema,
            required: true,
        },
        orderType: {
            type: String,
            enum: Object.values(ORDER_TYPES),
            required: true,
        },
        packageDetails: {
            slug: { type: String },
            tier: { type: String },
            title: { type: String },
        },
        customPurpose: {
            type: String,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },
        currency: {
            type: String,
            default: "USD",
            uppercase: true,
            trim: true,
        },
        paymentStatus: {
            type: String,
            enum: Object.values(PAYMENT_STATUS),
            default: PAYMENT_STATUS.PENDING,
        },
        gatewayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gateway",
        },
        provider: {
            type: String,
            lowercase: true,
            enum: [...PROVIDER_LIST, "none"],
            default: "none",
        },
        providerReference: {
            type: String,
            index: true,
        },
        transactionId: {
            type: String,
        },
        webhookToken: {
            type: String,
            required: true,
            select: false,
        },
        paidAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
