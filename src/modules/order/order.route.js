import express from "express";
import { createPaymentSession, getOrderPaymentStatus } from "./order.controller.js";

const router = express.Router();

router.post("/create-payment", createPaymentSession);
router.get("/:orderId/status", getOrderPaymentStatus);

export default router;
