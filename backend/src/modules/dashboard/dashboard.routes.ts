import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { salesReportQuerySchema } from "./dashboard.schemas";
import * as dashboardController from "./dashboard.controller";

const router = Router();

// Cualquier usuario autenticado puede ver su dashboard — el scoping por rol
// (qué facturas cuentan como "suyas") lo aplica dashboard.service.ts, no una
// restricción de ruta.
router.use(requireAuth);

router.get("/summary", dashboardController.getSummary);
router.get("/sales-report", validate({ query: salesReportQuerySchema }), dashboardController.getSalesReport);

export default router;
