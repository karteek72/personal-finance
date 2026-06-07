"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ListQuery } from "@/types/api";
import type { SortDir } from "@/components/ui/data-table";

interface UseListQueryUrlOptions {
  defaults: Required<Pick<ListQuery, "page" | "pageSize" | "sort" | "dir">>;
  /** URL param prefix to avoid collisions when multiple tables share a page. */
  prefix?: string;
}

function paramKey(base: string, prefix?: string): string {
  return prefix ? `${prefix}${base.charAt(0).toUpperCase()}${base.slice(1)}` : base;
}

function readInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readDir(value: string | null, fallback: SortDir): SortDir {
  return value === "asc" || value === "desc" ? value : fallback;
}

/**
 * Mirrors sort/filter/page state in the URL for shareable, bookmarkable tables.
 * Parent passes the returned query to TanStack Query (server-driven rows only).
 */
export function useListQueryUrl({
  defaults,
  prefix,
}: UseListQueryUrlOptions): [ListQuery, (patch: Partial<ListQuery>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo((): ListQuery => {
    const qParam = searchParams.get(paramKey("q", prefix));
    return {
      page: readInt(searchParams.get(paramKey("page", prefix)), defaults.page),
      pageSize: readInt(
        searchParams.get(paramKey("pageSize", prefix)),
        defaults.pageSize,
      ),
      sort: searchParams.get(paramKey("sort", prefix)) ?? defaults.sort,
      dir: readDir(searchParams.get(paramKey("dir", prefix)), defaults.dir),
      q: qParam?.trim() || undefined,
    };
  }, [searchParams, defaults, prefix]);

  const setQuery = useCallback(
    (patch: Partial<ListQuery>) => {
      const next: ListQuery = { ...query, ...patch };
      const params = new URLSearchParams(searchParams.toString());

      const entries: [string, string | undefined][] = [
        [paramKey("page", prefix), String(next.page ?? defaults.page)],
        [paramKey("pageSize", prefix), String(next.pageSize ?? defaults.pageSize)],
        [paramKey("sort", prefix), next.sort ?? defaults.sort],
        [paramKey("dir", prefix), next.dir ?? defaults.dir],
        [paramKey("q", prefix), next.q],
      ];

      for (const [key, value] of entries) {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [query, defaults, prefix, pathname, router, searchParams],
  );

  return [query, setQuery];
}
