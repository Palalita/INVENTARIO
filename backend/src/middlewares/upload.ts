// Middleware de subida de archivos (multer) para las imágenes de producto.
// Solo valida el nombre/tamaño/Content-Type declarado del archivo — la
// verificación de que el CONTENIDO real coincida con ese tipo (firma de
// bytes) se hace después, en products.service.ts, porque el Content-Type
// que manda el cliente se puede falsificar fácilmente.
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// memoryStorage: el archivo queda en un Buffer en RAM (req.file.buffer), no
// se escribe a disco — conveniente porque de ahí se sube directo a R2 sin
// pasos intermedios, y no deja archivos temporales huérfanos en el server.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new AppError(400, "INVALID_FILE_TYPE", "Solo se permiten imágenes JPEG, PNG o WEBP"));
      return;
    }
    cb(null, true);
  }
});

// Fábrica de middleware: uploadImage("image") devuelve un middleware listo
// para usar en una ruta (`router.post("/:id/image", uploadImage("image"),
// controller)`). Envuelve multer para traducir sus errores (archivo
// demasiado grande, tipo no permitido, ausencia de archivo) al formato de
// error consistente del resto de la API (AppError), en vez de dejar pasar
// los errores crudos de multer.
export function uploadImage(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(AppError.badRequest("La imagen no puede superar 5MB", "FILE_TOO_LARGE"));
          return;
        }
        next(AppError.badRequest(err.message, "UPLOAD_ERROR"));
        return;
      }
      if (err) {
        next(err);
        return;
      }
      if (!req.file) {
        next(AppError.badRequest("No se recibió ninguna imagen", "NO_FILE"));
        return;
      }
      next();
    });
  };
}
