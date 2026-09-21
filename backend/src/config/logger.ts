// Logger estructurado (JSON) compartido por toda la app — lo usan app.ts
// (pino-http) y cualquier módulo que necesite loguear algo puntual.
import pino from "pino";
import { env, isProduction, isTest } from "./env";

// Nivel de log: silencioso en tests (para no ensuciar la salida de vitest),
// "info" en producción, "debug" en desarrollo — salvo que LOG_LEVEL lo
// sobreescriba explícitamente. En desarrollo además usa "pino-pretty" para
// imprimir líneas legibles en la terminal en vez de JSON crudo; en
// producción se deja el JSON tal cual, que es lo que esperan la mayoría de
// plataformas de logging (Railway, Datadog, etc.).
export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? "silent" : isProduction ? "info" : "debug"),
  // pino-http (ver app.ts) loguea req.headers/res.headers completos por
  // defecto en cada línea de request. Sin esto, el header Authorization
  // (JWT de acceso) y la cookie de refresh token quedaban en texto plano en
  // cada log de producción — cualquiera con acceso a los logs de Railway
  // podía tomar esos valores y hacerse pasar por el usuario. `remove: true`
  // borra la clave entera en vez de dejar "[Redacted]", para no sugerir
  // siquiera el formato del valor.
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    remove: true
  },
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" }
        }
      : undefined
});
