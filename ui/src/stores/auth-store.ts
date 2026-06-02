"use client";

import { create } from "zustand";

import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
  type StoredAuthSession,
} from "@/lib/auth-session";
import type { User } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setSession: (session: StoredAuthSession) => void;
  clearSession: () => void;
};

/** Same on server and client until hydrate() runs in useEffect. */
const initialAuthState = {
  status: "loading" as const,
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialAuthState,
  hydrate() {
    const session = readAuthSession();
    if (session) {
      set({
        status: "authenticated",
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        hydrated: true,
      });
      return;
    }
    set({
      status: "unauthenticated",
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: true,
    });
  },
  setSession(session) {
    writeAuthSession(session);
    set({
      status: "authenticated",
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      hydrated: true,
    });
  },
  clearSession() {
    clearAuthSession();
    set({
      status: "unauthenticated",
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: true,
    });
  },
}));
