"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Reusable, server-driven data table for paginated/sortable/filterable reports.
 * It performs NO aggregation — it renders the `rows` the backend computed and
 * emits sort/filter/page changes to the parent. See analytics-architecture.md
 * section 10.4. The parent owns query state and fetching (TanStack Query).
 */

export type SortDir = "asc" | "desc";

export interface DataTableColumn<TRow> {
  /** Must match the server-whitelisted sort key when `sortable`. */
  id: string;
  header: string;
  align?: "left" | "right";
  sortable?: boolean;
  render: (row: TRow) => ReactNode;
  /** Optional grid/flex width hint applied to the cell. */
  width?: string;
}

interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: SortDir;
  onSortChange: (sort: string, dir: SortDir) => void;
  onPageChange: (page: number) => void;
  /** Omit to hide the search box. */
  onSearch?: (q: string) => void;
  searchValue?: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  isFetching?: boolean;
  emptyMessage?: string;
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "ml-1 inline-block text-[9px] leading-none transition-opacity",
        active ? "opacity-100 text-primary" : "opacity-30",
      )}
    >
      {active ? (dir === "asc" ? "▲" : "▼") : "▲"}
    </span>
  );
}

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  sort,
  dir,
  onSortChange,
  onPageChange,
  onSearch,
  searchValue,
  searchPlaceholder = "Search…",
  isLoading = false,
  isFetching = false,
  emptyMessage = "No results.",
}: DataTableProps<TRow>) {
  const [searchDraft, setSearchDraft] = useState(searchValue ?? "");

  // Debounce search input → onSearch.
  useEffect(() => {
    if (!onSearch) return;
    const handle = setTimeout(() => {
      if (searchDraft !== (searchValue ?? "")) {
        onSearch(searchDraft.trim());
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  function toggleSort(columnId: string) {
    if (sort === columnId) {
      onSortChange(columnId, dir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(columnId, "desc");
    }
  }

  return (
    <div className="space-y-3">
      {onSearch ? (
        <div className="relative">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
          />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={clsx(
                    "px-4 py-2.5 font-semibold",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.id)}
                      className={clsx(
                        "inline-flex items-center uppercase tracking-wide hover:text-text",
                        col.align === "right" && "flex-row-reverse",
                        sort === col.id && "text-text",
                      )}
                      aria-sort={
                        sort === col.id
                          ? dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {col.header}
                      <SortIndicator active={sort === col.id} dir={dir} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={clsx(isFetching && !isLoading && "opacity-60")}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border/60 last:border-0">
                  {columns.map((col) => (
                    <td key={col.id} className="px-4 py-3">
                      <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-border/60" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-border/60 last:border-0"
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={clsx(
                        "px-4 py-3",
                        col.align === "right" && "text-right tabular-nums",
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
        <span aria-live="polite">
          {total === 0
            ? "0 results"
            : `${firstRow}–${lastRow} of ${total.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-primary"
          >
            Prev
          </button>
          <span className="tabular-nums">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="rounded-[var(--radius-sm)] border border-border px-2.5 py-1 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-primary"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
