import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { salesReportQuerySchema } from "./dashboard.schemas";
import * as dashboardController from "./dashboard.controller";

const router = Router();

router.use(requireAuth);

router.get("/summary", dashboardController.getSummary);
router.get("/sales-report", validate({ query: salesReportQuerySchema }), dashboardController.getSalesReport);

export default router;
