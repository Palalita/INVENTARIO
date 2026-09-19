// Punto de entrada real del proceso Node (el que corren "npm run dev" y
// "npm start"). Separado de app.ts para poder importar la app de Express en
// los tests sin levantar un servidor HTTP de verdad (ver backend/tests/*).
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

const app = createApp();

// Arranca el servidor HTTP en el puerto configurado (env.PORT, o el que
// inyecte la plataforma de hosting, ej. Railway).
app.listen(env.PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.PORT}`);
});
