import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
