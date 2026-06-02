import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mocksDir = join(dirname(fileURLToPath(import.meta.url)), "../mocks");

function readMock<T>(filename: string): T {
  const raw = readFileSync(join(mocksDir, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export interface PaginatedTransactions {
  items: Array<Record<string, unknown>>;
  nextCursor: string | null;
}

export function getSummary() {
  return readMock("summary.json");
}

export function getTransactions(filters: {
  month?: string;
  category?: string;
  accountId?: string;
  q?: string;
  type?: string;
  limit?: number;
  cursor?: string;
}): PaginatedTransactions {
  const data = readMock<PaginatedTransactions>("transactions.json");
  let items = [...data.items];

  if (filters.month) {
    items = items.filter((tx) => String(tx.date).startsWith(filters.month!));
  }
  if (filters.category) {
    items = items.filter((tx) => tx.category === filters.category);
  }
  if (filters.accountId) {
    items = items.filter((tx) => tx.accountId === filters.accountId);
  }
  if (filters.type) {
    items = items.filter((tx) => tx.transactionType === filters.type);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    items = items.filter((tx) => {
      const name = String(tx.name ?? "").toLowerCase();
      const merchant = String(tx.merchantName ?? "").toLowerCase();
      return name.includes(q) || merchant.includes(q);
    });
  }

  const limit = filters.limit ?? 50;
  let start = 0;
  if (filters.cursor) {
    const index = items.findIndex((tx) => tx.id === filters.cursor);
    start = index >= 0 ? index + 1 : 0;
  }

  const page = items.slice(start, start + limit);
  const nextCursor =
    start + limit < items.length ? String(page[page.length - 1]?.id ?? null) : null;

  return { items: page, nextCursor };
}

export function getAccounts() {
  return readMock("accounts.json");
}

export function getAlerts() {
  return readMock("alerts.json");
}

export function getCategories() {
  return readMock("categories.json");
}

export function getMoneyFlow() {
  return readMock("money-flow.json");
}

export function getTrends() {
  return readMock("trends.json");
}
