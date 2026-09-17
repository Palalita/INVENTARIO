import pino from "pino";
import { env, isProduction, isTest } from "./env";

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
