import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyticsDateRange } from "../date-ranges.js";
import { formatLocalDate, parseLocalDate } from "../local-date.js";

describe("local date helpers", () => {
  it("formatLocalDate uses local Y/M/D without UTC shift", () => {
    const local = new Date(2024, 5, 1, 23, 59, 59);
    assert.equal(formatLocalDate(local), "2024-06-01");
    assert.notEqual(local.toISOString().slice(0, 10), formatLocalDate(local));
  });

  it("parseLocalDate treats YYYY-MM-DD as local calendar day", () => {
    const parsed = parseLocalDate("2024-06-15");
    assert.equal(parsed.getFullYear(), 2024);
    assert.equal(parsed.getMonth(), 5);
    assert.equal(parsed.getDate(), 15);
  });

  it("parseLocalDate round-trips YYYY-MM-DD without UTC shift", () => {
    for (const iso of ["2024-01-01", "2024-06-15", "2024-12-31"]) {
      const parsed = parseLocalDate(iso);
      assert.equal(formatLocalDate(parsed), iso);
      assert.equal(parsed.getFullYear(), Number(iso.slice(0, 4)));
      assert.equal(parsed.getMonth(), Number(iso.slice(5, 7)) - 1);
      assert.equal(parsed.getDate(), Number(iso.slice(8, 10)));
    }
  });

  it("parseLocalDate differs from ECMAScript UTC date-only parse west of UTC", () => {
    const iso = "2024-01-01";
    const local = parseLocalDate(iso);
    const utcMidnight = new Date(iso);
    if (new Date().getTimezoneOffset() > 0) {
      assert.notEqual(
        local.getDate(),
        utcMidnight.getDate(),
        "UTC-midnight parse shifts calendar day in negative-offset zones",
      );
    }
    assert.equal(local.getDate(), 1);
  });

  it("analyticsDateRange emits local from/to strings", () => {
    const range = analyticsDateRange(1);
    assert.match(range.from, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(range.to, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(range.from <= range.to, true);

    const fromParts = range.from.split("-").map(Number);
    const toParts = range.to.split("-").map(Number);
    const fromLocal = new Date(fromParts[0]!, fromParts[1]! - 1, fromParts[2]!);
    const toLocal = new Date(toParts[0]!, toParts[1]! - 1, toParts[2]!);
    assert.equal(range.from, formatLocalDate(fromLocal));
    assert.equal(range.to, formatLocalDate(toLocal));
  });
});
