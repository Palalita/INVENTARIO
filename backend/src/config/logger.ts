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
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" }
        }
      : undefined
});
