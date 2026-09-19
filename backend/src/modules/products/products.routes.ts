import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { uploadImage } from "../../middlewares/upload";
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

// Leer productos y sus movimientos de stock: cualquier usuario autenticado
// (un VENDEDOR los necesita para armar facturas). Crear, editar, borrar y
// gestionar la imagen son operaciones exclusivas de ADMIN.
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

// uploadImage("image") corre DESPUÉS de validar los params (para no
// procesar un archivo de un id inválido) y ANTES del controlador: deja el
// archivo ya parseado en req.file.
router.post(
  "/:id/image",
  requireRole(Role.ADMIN),
  validate({ params: idParamSchema }),
  uploadImage("image"),
  productsController.uploadProductImage
);
router.delete(
  "/:id/image",
  requireRole(Role.ADMIN),
  validate({ params: idParamSchema }),
  productsController.deleteProductImage
);

// Movimientos de stock anidados bajo /products/:id/movements — viven en su
// propio módulo (stock-movements) pero se montan aquí porque su URL
// pertenece al recurso "producto". Listar movimientos no requiere ser
// ADMIN (a diferencia de products.routes en general) porque un VENDEDOR
// también puede registrar/ver ajustes de stock.
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
