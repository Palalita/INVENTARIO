// Error "de negocio" que cualquier capa del backend (services, controllers,
// middlewares) puede lanzar para comunicar un fallo esperado con su código
// HTTP correcto. `errorHandler.ts` sabe reconocer esta clase y responder
// exactamente con statusCode/code/message/details — así el resto del código
// no arma objetos de respuesta HTTP a mano, solo hace `throw AppError.algo(...)`.
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

  // Fábricas estáticas para los códigos HTTP más comunes, con un `code`
  // (string estable, pensado para que el frontend pueda reaccionar a un
  // error específico) y `message` (texto legible) por defecto razonables.
  // Usarlas (`AppError.notFound(...)`) es más corto y consistente que
  // escribir `new AppError(404, "NOT_FOUND", ...)` en cada módulo.
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
