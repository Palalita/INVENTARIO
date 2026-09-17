import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import { loginRateLimiter } from "../../middlewares/rateLimit";
import { loginSchema } from "./auth.schemas";
import * as authController from "./auth.controller";

const router = Router();

router.post("/login", loginRateLimiter, validate({ body: loginSchema }), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

export default router;
