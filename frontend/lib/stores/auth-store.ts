import { create } from "zustand";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  /** True while we attempt to restore a session via /auth/refresh on app load. */
  isBootstrapping: boolean;
  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string | null) => void;
  clearSession: () => void;
  setBootstrapping: (value: boolean) => void;
}

// Session lives in memory only, as required by 02-prd.md: the refresh token is the
// long-lived credential and lives in an httpOnly cookie managed by the backend.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isBootstrapping: true,
  setSession: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ user: null, accessToken: null }),
  setBootstrapping: (value) => set({ isBootstrapping: value }),
}));

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}
