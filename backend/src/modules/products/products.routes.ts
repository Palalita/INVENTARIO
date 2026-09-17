import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  createProductSchema,
  idParamSchema,
  listProductsQuerySchema,
  updateProductSchema
} from "./products.schemas";
import * as productsController from "./products.controller";
import {
  createMovementSchema,
  listMovementsQuerySchema,
  productIdParamSchema
} from "../stock-movements/stock-movements.schemas";
import * as movementsController from "../stock-movements/stock-movements.controller";

const router = Router();

router.use(requireAuth);

router.get("/", validate({ query: listProductsQuerySchema }), productsController.listProducts);
router.get("/:id", validate({ params: idParamSchema }), productsController.getProduct);
router.post(
  "/",
  requireRole(Role.ADMIN),
  validate({ body: createProductSchema }),
  productsController.createProduct
);
router.patch(
  "/:id",
  requireRole(Role.ADMIN),
  validate({ params: idParamSchema, body: updateProductSchema }),
  productsController.updateProduct
);
router.delete(
  "/:id",
  requireRole(Role.ADMIN),
  validate({ params: idParamSchema }),
  productsController.deleteProduct
);

router.get(
  "/:id/movements",
  validate({ params: productIdParamSchema, query: listMovementsQuerySchema }),
  movementsController.listMovements
);
router.post(
  "/:id/movements",
  validate({ params: productIdParamSchema, body: createMovementSchema }),
  movementsController.createMovement
);

export default router;
