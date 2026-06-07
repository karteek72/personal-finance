import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../errors.js";
import {
  paginateInMemory,
  parseListQuery,
} from "../list-query.js";

interface Row {
  label: string;
  amount: number;
}

const ROWS: Row[] = [
  { label: "Alpha", amount: 100 },
  { label: "Beta", amount: 200 },
  { label: "Gamma", amount: 50 },
];

test("parseListQuery rejects invalid sort column", () => {
  assert.throws(
    () =>
      parseListQuery({ sort: "bad" }, {
        sortable: ["amount"],
        defaultSort: "amount",
      }),
    (err: unknown) => err instanceof AppError && err.statusCode === 400,
  );
});

test("paginateInMemory sorts, filters, and slices", () => {
  const q = parseListQuery(
    { page: 1, pageSize: 2, sort: "amount", dir: "desc", q: "beta" },
    { sortable: ["amount", "label"], defaultSort: "amount" },
  );

  const page = paginateInMemory(ROWS, q, {
    sortKey: (col) =>
      col === "label" ? (r) => r.label.toLowerCase() : (r) => r.amount,
    textFilter: (row, needle) => row.label.toLowerCase().includes(needle),
  });

  assert.equal(page.total, 1);
  assert.deepEqual(page.rows.map((r) => r.label), ["Beta"]);
  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 2);
  assert.equal(page.appliedFilters.q, "beta");
});
