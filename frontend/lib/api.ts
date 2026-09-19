import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken, useAuthStore } from "@/lib/stores/auth-store";
import type { ApiErrorBody, LoginResponse } from "@/lib/types";

// URL base del backend. En local apunta a localhost:4000; en producción se
// inyecta vía NEXT_PUBLIC_API_URL (variable de entorno de Vercel).
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Cliente HTTP principal de toda la app. Todas las llamadas a la API pasan
// por aquí para heredar los interceptores de abajo (token + refresh automático).
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send/receive the httpOnly refresh-token cookie
});

// Separate instance (no interceptors) used exclusively for the refresh call so it
// never recurses into the 401 handler below.
const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Antes de cada request, agrega el access token (JWT, vive en memoria vía
// el store de Zustand) como header Authorization.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Evita disparar varios POST /auth/refresh en paralelo si varias requests
// reciben 401 al mismo tiempo: todas comparten la misma promesa en vuelo.
let refreshPromise: Promise<string | null> | null = null;

// Pide un access token nuevo usando la cookie httpOnly de refresh (el
// navegador la manda solo porque refreshClient tiene withCredentials).
// Devuelve null si el refresh falla (sesión vencida o inválida).
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{ accessToken: string }>("/auth/refresh")
      .then((res) => res.data.accessToken)
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Limpia la sesión local y manda al usuario a /login cuando el refresh falla
// definitivamente (no hay forma de recuperar la sesión).
function redirectToLogin() {
  useAuthStore.getState().clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

// Interceptor central de errores: si una request falla con 401 (access
// token vencido, dura 15 min), intenta refrescar el token una sola vez y
// reintenta la request original con el token nuevo. Si el refresh también
// falla, cierra la sesión. `_retry` evita loops infinitos de reintento.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/");

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        useAuthStore.getState().setAccessToken(newToken);
        originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
        return api(originalRequest);
      }
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

// Extrae el mensaje de error legible que manda el backend (formato
// { error: { message, code, details } }), o un mensaje genérico si el error
// no vino de la API (ej. falla de red).
export function getApiErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado"): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}

// Extrae el código de error de negocio (ej. "INSUFFICIENT_STOCK") para que
// la UI pueda reaccionar a casos específicos sin parsear el mensaje.
export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.code;
  }
  return undefined;
}

// Extrae los detalles de validación (ej. errores de Zod campo por campo).
export function getApiErrorDetails(error: unknown): ApiErrorBody["error"]["details"] {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.details;
  }
  return undefined;
}

// Llama a POST /auth/login. El backend responde con el usuario + access
// token, y de paso pone la cookie httpOnly de refresh.
export async function login(email: string, password: string) {
  const { data } = await refreshClient.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

// Cierra sesión en el backend (invalida el refresh token y borra la cookie).
// Si la llamada falla igual se ignora: el logout local (clearSession) es lo
// que realmente importa para la UI.
export async function logout() {
  await refreshClient.post("/auth/logout").catch(() => undefined);
}

// Trae los datos del usuario autenticado actual usando el access token.
export async function fetchMe() {
  const { data } = await api.get<{ user: LoginResponse["user"] }>("/auth/me");
  return data.user;
}

// Se llama al cargar la app (ver AuthGuard): intenta restaurar la sesión
// usando la cookie de refresh, sin pedirle credenciales al usuario de nuevo.
// Devuelve el usuario si la sesión sigue viva, o null si hay que ir a /login.
export async function bootstrapSession() {
  const token = await refreshAccessToken();
  if (!token) return null;
  useAuthStore.getState().setAccessToken(token);
  try {
    const user = await fetchMe();
    useAuthStore.getState().setSession(user, token);
    return user;
  } catch {
    useAuthStore.getState().clearSession();
    return null;
  }
}
