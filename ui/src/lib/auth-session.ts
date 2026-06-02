import type { User } from "@/types/api";

const STORAGE_KEY = "spendflow_auth";

export type StoredAuthSession = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export function readAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "accessToken" in parsed &&
      "refreshToken" in parsed &&
      "user" in parsed &&
      typeof (parsed as StoredAuthSession).accessToken === "string" &&
      typeof (parsed as StoredAuthSession).refreshToken === "string"
    ) {
      return parsed as StoredAuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

const ACCESS_COOKIE = "spendflow_access";
const ACCESS_MAX_AGE_SEC = 60 * 60 * 24;

export function writeAuthSession(session: StoredAuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(session.accessToken)}; path=/; max-age=${ACCESS_MAX_AGE_SEC}; SameSite=Lax`;
}

export function clearAuthSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${ACCESS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasStoredSession(): boolean {
  return readAuthSession() !== null;
}

export function getAccessToken(): string | null {
  return readAuthSession()?.accessToken ?? null;
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());
}

export function requiresSignIn(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_MOCKS === "false" && isGoogleAuthEnabled()
  );
}
