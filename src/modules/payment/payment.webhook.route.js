import express from "express";
import { handleKunnectWebhook } from "./providers/kunnect/kunnect.webhook.js";

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.post("/kunnect", handleKunnectWebhook);
router.get("/kunnect", handleKunnectWebhook);

export default router;
