import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { createUserSchema, idParamSchema, listUsersQuerySchema, updateUserSchema } from "./users.schemas";
import * as usersController from "./users.controller";

const router = Router();

router.use(requireAuth, requireRole(Role.ADMIN));

router.get("/", validate({ query: listUsersQuerySchema }), usersController.listUsers);
router.post("/", validate({ body: createUserSchema }), usersController.createUser);
router.patch("/:id", validate({ params: idParamSchema, body: updateUserSchema }), usersController.updateUser);

export default router;
