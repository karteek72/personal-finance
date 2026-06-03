import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertExportHasNoSecrets,
  FORBIDDEN_EXPORT_KEYS,
} from "../export-user-data.js";

test("assertExportHasNoSecrets passes on clean payload", () => {
  assert.doesNotThrow(() =>
    assertExportHasNoSecrets({
      user: { id: "u1", email: "a@example.com" },
      accounts: [{ id: "a1", mask: "1234" }],
      transactions: [{ id: "t1", amount: "10.00" }],
    }),
  );
});

test("assertExportHasNoSecrets rejects forbidden secret fields", () => {
  for (const key of FORBIDDEN_EXPORT_KEYS) {
    assert.throws(
      () => assertExportHasNoSecrets({ nested: { [key]: "secret-value" } }),
      /Forbidden export field/,
    );
  }
});

test("assertExportHasNoSecrets scans nested arrays", () => {
  assert.throws(
    () =>
      assertExportHasNoSecrets({
        importFiles: [{ id: "f1", contentEncrypted: "blob" }],
      }),
    /contentEncrypted/,
  );
});
