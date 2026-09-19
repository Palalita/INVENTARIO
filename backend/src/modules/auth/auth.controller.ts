// Controladores HTTP de auth: reciben la request, delegan la lógica a
// auth.service.ts, y se encargan de la parte específica de HTTP que no le
// corresponde al service (poner/leer la cookie del refresh token, dar forma
// a la respuesta JSON).
import { Request, Response } from "express";
import { isProduction } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as authService from "./auth.service";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// "none" es necesario porque frontend (Vercel) y backend (Railway) viven en
// dominios distintos; con "strict"/"lax" el navegador nunca envía la cookie
// entre sitios y el refresh siempre falla. Requiere secure: true (solo se usa
// en producción, donde ya corre bajo HTTPS).
const REFRESH_COOKIE_SAME_SITE = isProduction ? "none" : "strict";

// Manda el refresh token al navegador como cookie httpOnly (JS del cliente
// no puede leerla, solo se envía automáticamente en cada request al
// backend). Se llama tras login() y refresh() para renovar la cookie con el
// token rotado.
function setRefreshCookie(res: Response, rawToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: REFRESH_COOKIE_SAME_SITE,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/"
  });
}

// Borra la cookie de refresh token (logout). Las opciones (httpOnly,
// secure, sameSite, path) deben coincidir exactamente con las usadas al
// crearla, o el navegador no la reconoce como la misma cookie y no la borra.
function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: REFRESH_COOKIE_SAME_SITE,
    path: "/"
  });
}

// POST /auth/login — valida credenciales, devuelve el usuario + access
// token en el body JSON, y deja el refresh token en la cookie httpOnly.
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, rawRefreshToken } = await authService.login(req.body);
  setRefreshCookie(res, rawRefreshToken);
  res.status(200).json(serialize({ user, accessToken }));
});

// POST /auth/refresh — lee el refresh token de la cookie (nunca del body:
// así un script en el navegador no puede leerlo ni mandarlo a otro lado), lo
// canjea por un access token nuevo y rota la cookie.
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const { accessToken, rawRefreshToken } = await authService.refresh(rawToken);
  setRefreshCookie(res, rawRefreshToken);
  res.status(200).json({ accessToken });
});

// POST /auth/logout — revoca el refresh token actual en la base de datos y
// borra la cookie. 204 (sin body) porque no hay nada que devolver.
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  res.status(204).send();
});

// GET /auth/me — requiere requireAuth previo (ver auth.routes.ts), que ya
// dejó el id del usuario en req.user.sub. Lo usa el frontend para saber
// quién es el usuario logueado al cargar la app.
export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.sub);
  res.status(200).json(serialize({ user }));
});
