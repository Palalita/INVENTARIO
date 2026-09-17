export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, code = "BAD_REQUEST", details?: unknown) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = "No autorizado", code = "UNAUTHORIZED") {
    return new AppError(401, code, message);
  }

  static forbidden(message = "Acceso denegado", code = "FORBIDDEN") {
    return new AppError(403, code, message);
  }

  static notFound(message = "Recurso no encontrado", code = "NOT_FOUND") {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT", details?: unknown) {
    return new AppError(409, code, message, details);
  }
}
