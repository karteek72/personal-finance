import { z } from "zod";
import { AppError } from "./errors.js";

/**
 * Shared list/pagination contract for tabular report endpoints.
 * See docs/architecture/analytics-architecture.md section 10.3.
 *
 * Offset pagination with a total count. Sort columns are server-whitelisted
 * (invalid sort -> 400) so an arbitrary column name can never reach SQL.
 */

export type SortDir = "asc" | "desc";

export interface Page<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  dir: SortDir;
  appliedFilters: Record<string, string>;
}

export interface ParsedListQuery {
  page: number;
  pageSize: number;
  sort: string;
  dir: SortDir;
  q?: string;
  from?: string;
  to?: string;
  /** Zero-based offset derived from page/pageSize. */
  offset: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const baseSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().min(1).max(40).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
});

export interface ParseListQueryOptions {
  /** Whitelisted sortable columns. Anything else -> 400. */
  sortable: readonly string[];
  defaultSort: string;
  defaultDir?: SortDir;
}

export function parseListQuery(
  query: unknown,
  opts: ParseListQueryOptions,
): ParsedListQuery {
  const parsed = baseSchema.safeParse(query ?? {});
  if (!parsed.success) {
    throw AppError.validation(
      "Invalid list query",
      parsed.error.flatten().fieldErrors,
    );
  }

  const sort = parsed.data.sort ?? opts.defaultSort;
  if (!opts.sortable.includes(sort)) {
    throw AppError.validation(`Invalid sort column: ${sort}`, {
      sort: [`Allowed values: ${opts.sortable.join(", ")}`],
    });
  }

  const { page, pageSize, q, from, to } = parsed.data;
  const dir: SortDir = parsed.data.dir ?? opts.defaultDir ?? "desc";

  return {
    page,
    pageSize,
    sort,
    dir,
    q,
    from,
    to,
    offset: (page - 1) * pageSize,
  };
}

/** Wrap a page of already-sorted, already-sliced rows in the response envelope. */
export function buildPage<T>(
  rows: T[],
  total: number,
  q: ParsedListQuery,
): Page<T> {
  const appliedFilters: Record<string, string> = {};
  if (q.q) appliedFilters.q = q.q;
  if (q.from) appliedFilters.from = q.from;
  if (q.to) appliedFilters.to = q.to;

  return {
    rows,
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    sort: q.sort,
    dir: q.dir,
    appliedFilters,
  };
}

/** Stable comparator for in-memory sorting by a typed key + direction. */
export function compareBy<T>(
  key: (row: T) => number | string,
  dir: SortDir,
): (a: T, b: T) => number {
  const factor = dir === "asc" ? 1 : -1;
  return (a, b) => {
    const av = key(a);
    const bv = key(b);
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * factor;
    }
    return String(av).localeCompare(String(bv)) * factor;
  };
}
