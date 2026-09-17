import { Request, Response } from "express";
import { isProduction } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as authService from "./auth.service";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, rawToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/"
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, secure: isProduction, sameSite: "strict", path: "/" });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, rawRefreshToken } = await authService.login(req.body);
  setRefreshCookie(res, rawRefreshToken);
  res.status(200).json(serialize({ user, accessToken }));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const { accessToken, rawRefreshToken } = await authService.refresh(rawToken);
  setRefreshCookie(res, rawRefreshToken);
  res.status(200).json({ accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.sub);
  res.status(200).json(serialize({ user }));
});
