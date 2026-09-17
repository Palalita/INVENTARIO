import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken, useAuthStore } from "@/lib/stores/auth-store";
import type { ApiErrorBody, LoginResponse } from "@/lib/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

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

export function getApiErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado"): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.code;
  }
  return undefined;
}

export function getApiErrorDetails(error: unknown): ApiErrorBody["error"]["details"] {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.details;
  }
  return undefined;
}

export async function login(email: string, password: string) {
  const { data } = await refreshClient.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function logout() {
  await refreshClient.post("/auth/logout").catch(() => undefined);
}

export async function fetchMe() {
  const { data } = await api.get<{ user: LoginResponse["user"] }>("/auth/me");
  return data.user;
}

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
