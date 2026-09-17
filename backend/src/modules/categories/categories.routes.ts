import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { createCategorySchema, idParamSchema, updateCategorySchema } from "./categories.schemas";
import * as categoriesController from "./categories.controller";

const router = Router();

router.use(requireAuth);

router.get("/", categoriesController.listCategories);
router.post("/", requireRole(Role.ADMIN), validate({ body: createCategorySchema }), categoriesController.createCategory);
router.patch(
  "/:id",
  requireRole(Role.ADMIN),
  validate({ params: idParamSchema, body: updateCategorySchema }),
  categoriesController.updateCategory
);
router.delete("/:id", requireRole(Role.ADMIN), validate({ params: idParamSchema }), categoriesController.deleteCategory);

export default router;
