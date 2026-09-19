// Envoltorio para controladores async. Express (en la versión usada aquí)
// no captura automáticamente un `Promise` rechazado dentro de un handler de
// ruta: si un controlador `async` lanza un error y nadie hace `.catch`, la
// request se queda colgada y el error no llega a errorHandler.ts.
// asyncHandler soluciona esto una sola vez: todos los *.controller.ts
// envuelven su función con `asyncHandler(async (req, res) => {...})`, y
// aquí se encarga de mandar cualquier rechazo a `next(err)`.
import { NextFunction, Request, Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (fn: Handler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
