import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  createInvoiceSchema,
  idParamSchema,
  listInvoicesQuerySchema
} from "./invoices.schemas";
import * as invoicesController from "./invoices.controller";

const router = Router();

router.use(requireAuth);

router.get("/", validate({ query: listInvoicesQuerySchema }), invoicesController.listInvoices);
router.get("/:id", validate({ params: idParamSchema }), invoicesController.getInvoice);
router.post("/", validate({ body: createInvoiceSchema }), invoicesController.createInvoice);
router.patch(
  "/:id/cancel",
  requireRole(Role.ADMIN),
  validate({ params: idParamSchema }),
  invoicesController.cancelInvoice
);
router.get("/:id/pdf", validate({ params: idParamSchema }), invoicesController.getInvoicePdf);

export default router;
