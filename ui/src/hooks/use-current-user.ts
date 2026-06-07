"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { User } from "@/types/api";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** Signed-in user from the auth store, or `/auth/me` (dev user without Google session). */
export function useCurrentUser(): User | null {
  const storeUser = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.getMe().then((res) => res.user),
    enabled: !USE_MOCKS && hydrated && !storeUser,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  return storeUser ?? data ?? null;
}
