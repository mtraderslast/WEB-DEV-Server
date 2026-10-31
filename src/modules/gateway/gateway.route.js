import express from "express";
import { verifyToken } from "../../middleware/authMiddleware.js";
import protectRoute from "../../middleware/protectRoute.js";
import { ROLES } from "../../utils/roles.js";
import {
    createGateway,
    getGateways,
    getProviderCatalog,
    updateGateway,
} from "./gateway.controller.js";

const router = express.Router();

router.use(verifyToken, protectRoute(ROLES.ADMIN));

router.get("/providers", getProviderCatalog);
router.get("/", getGateways);
router.post("/", createGateway);
router.patch("/:id", updateGateway);

export default router;
