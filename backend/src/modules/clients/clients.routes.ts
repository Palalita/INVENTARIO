import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  createClientSchema,
  idParamSchema,
  listClientsQuerySchema,
  updateClientSchema
} from "./clients.schemas";
import * as clientsController from "./clients.controller";

const router = Router();

router.use(requireAuth);

router.get("/", validate({ query: listClientsQuerySchema }), clientsController.listClients);
router.get("/:id", validate({ params: idParamSchema }), clientsController.getClient);
router.post("/", validate({ body: createClientSchema }), clientsController.createClient);
router.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateClientSchema }),
  clientsController.updateClient
);
router.delete("/:id", requireRole(Role.ADMIN), validate({ params: idParamSchema }), clientsController.deleteClient);

export default router;
