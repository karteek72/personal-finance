# Statement Import → Plaid Bridge

**Status:** Planned  
**Last Updated:** June 2026  
**Goal:** Minimize Plaid cost while giving users deep history (5–10 years) from statements, then incremental live sync without duplicate accounts or transactions.

---

## Problem

Plaid is priced per connected **Item** (institution login) per month, and historical transaction depth is limited (typically ~24 months via Transactions sync). Users with long financial history need:

1. **Bulk historical load** from downloaded statements (QFX/OFX/CSV/PDF).
2. **Optional live sync** via Plaid for new activity only.
3. **Smart merge** when the same real-world account exists as both an imported account and a Plaid-linked account.

Users with **≤10 accounts** may skip bulk import and connect Plaid directly if they accept shorter history.

---

## Product paths (onboarding fork)

| Path | Who | History | Ongoing cost |
|------|-----|---------|--------------|
| **A — Statements first** | Power users, long history, cost-sensitive | 5–10 yrs from files | Plaid only after import, 1 Item per institution |
| **B — Plaid first** | ≤10 accounts, wants fast setup | ~24 months from Plaid | 1 Item per institution from day one |
| **C — Hybrid** | Imported history, adds Plaid later | Import + Plaid forward | Same as A after link |

Onboarding asks:

1. “How many accounts do you want to track?” (if ≤10, offer Plaid shortcut)
2. “Do you have downloaded statements (QFX/CSV/PDF)?” → upload wizard
3. “Connect live sync now or later?” → defer Plaid to reduce early Items

**Policy:** Recommend Path A when user has >10 accounts or needs >2 years of history. Cap Plaid-first at 10 accounts (configurable `MAX_PLAID_FIRST_ACCOUNTS`).

---

## What exists today

| Piece | Location | Notes |
|-------|----------|-------|
| CLI statement import | `backend/scripts/import-statements.ts` | QFX + BofA PDF parsers; hard-coded account keys |
| Account `source` | `accounts.source` | `import` \| `plaid` (schema ready) |
| Txn dedup (same account) | `(account_id, external_id)` unique | Import vs Plaid use different `external_id` formats → **no cross-source dedup yet** |
| Plaid upsert | `upsert-transactions.ts` | Upserts by Plaid `external_id` on linked account |
| Transfer reconciliation | `reconciliation/` | CC payments, internal transfers |

---

## Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Onboarding                                │
│  [Upload statements 5–10yr]  OR  [Plaid Link ≤10 accounts]       │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
                ▼                               ▼
     ┌──────────────────┐            ┌──────────────────┐
     │ Import pipeline  │            │ Plaid link/sync │
     │ (parse → batch)  │            │ (existing)      │
     └────────┬─────────┘            └────────┬─────────┘
              │                               │
              └──────────────┬────────────────┘
                             ▼
              ┌──────────────────────────┐
              │ Account resolution layer  │
              │ (match import ↔ Plaid)    │
              └────────────┬─────────────┘
                           ▼
              ┌──────────────────────────┐
              │ Transaction dedup layer   │
              │ fingerprint + upsert      │
              └────────────┬─────────────┘
                           ▼
                    PostgreSQL
```

---

## Phase 1 — User-facing statement import (MVP)

**Parser design:** See [import-parser-design.md](import-parser-design.md) for format detection, account auto-identification, banking vs brokerage routing, and high-volume trade handling.

**Backend**

- `POST /imports/statements` — multipart upload; creates `import_batches` row (status, file count, date range).
- Universal parser in `backend/src/services/import/` — **QFX/OFX, CSV, PDF**; account identity extracted from file (not hard-coded keys).
- **Banking** → `transactions`; **brokerage trades** → `investment_transactions` + `securities`.
- Create or update `accounts` with `source = 'import'`, `mask`, `institution_name`, `type`, `subtype` (including `investment` / `brokerage`).
- Worker job for large batches — brokerage months may contain **thousands** of trades; stream + batch insert (500–1000 rows).

**UI**

- Settings → **Import history** or onboarding step: drag-and-drop monthly files, assign files to account (or auto-detect from QFX ACCTID).
- Progress: parsed / inserted / skipped duplicates.
- Show coverage timeline per account (“Jan 2016 – May 2026”).

**Schema additions**

```sql
import_batches (
  id, user_id, status, files_total, txns_inserted, txns_skipped,
  date_min, date_max, created_at, completed_at
)

import_files (
  id, batch_id, filename, format, account_id, status, error_message
)
```

---

## Phase 2 — Account matching (import ↔ Plaid)

When user links Plaid **after** import, avoid a second account row for the same card/checking.

**Matching signals (score 0–100)**

| Signal | Weight |
|--------|--------|
| Institution name fuzzy match | 30 |
| Mask last-4 match | 40 |
| Account type/subtype match | 20 |
| Name similarity | 10 |

- Score ≥ **85**: auto-link (merge).
- Score **60–84**: suggest in UI — “Link to existing **Chase Sapphire ••7138**?”
- Score < **60**: create new Plaid account (user can manually merge).

**Merge operation**

1. Pick **canonical account** = existing import account (preserves history FKs).
2. Set `plaid_account_id`, `plaid_item_id` on canonical row; set `source = 'hybrid'`.
3. If Plaid sync already created a duplicate account row, **repoint** any Plaid-only transactions to canonical (or delete empty duplicate after merge).
4. Store audit row in `account_merge_log`.

**API**

- `GET /accounts/link-suggestions` — after Plaid exchange, returns import↔Plaid pairs.
- `POST /accounts/:id/link-plaid` — confirm merge `{ plaidAccountId }`.

---

## Phase 3 — Cross-source transaction deduplication

Import and Plaid use different `external_id` values for the same purchase. Dedup must happen **before** insert on Plaid sync.

**Fingerprint (per account)**

```
fingerprint = sha256(
  account_id |
  round(amount, 2) |
  date ± 1 calendar day bucket |
  normalize(merchant_name || name)
)
```

- Add `transactions.dedup_fingerprint` + unique index `(account_id, dedup_fingerprint)` (nullable until backfill).
- **On import insert:** compute fingerprint.
- **On Plaid upsert:**
  1. Compute fingerprint for incoming txn.
  2. If fingerprint exists → **do not insert**; optionally update `plaid_transaction_id` on existing row and enrich category/merchant if Plaid signal is better.
  3. If not exists → insert with `external_id = plaid:{transaction_id}`.

**Pending transactions:** Plaid pending rows may match posted import rows later — match on amount + merchant + date window; replace pending or mark `pending=false`.

**Overlap window:** After merge, run one-time **reconciliation job** over `[import_min_date, today]` to collapse duplicates from Plaid initial/historical pull.

---

## Phase 4 — Incremental Plaid sync (cost-aware)

**Principles**

- Plaid Items stay connected only for institutions where live sync is wanted.
- After history is satisfied by import, treat Plaid as **forward-looking** (+ short overlap for dedup).
- Use existing cursor sync; dedup layer prevents re-inserting overlapping history.

**Optional cost controls**

- `plaid_items.sync_mode`: `full` | `forward_only` (skip requesting historical update if import coverage ≥ N months).
- Defer linking low-value accounts (closed cards) — import only.
- Single Item per institution (already standard).

**User messaging**

- “Historical data from your statements through May 2026. Live sync adds new transactions from Plaid.”

---

## Phase 5 — Rules & guardrails

| Rule | Implementation |
|------|----------------|
| Plaid-first account limit | Block Link if `active_plaid_accounts > MAX` unless user completes import path |
| No duplicate accounts post-merge | DB constraint: one `plaid_account_id` per user |
| Category precedence | User override > Plaid > import parser |
| Source of truth for balance | Plaid when `source ∈ {plaid, hybrid}` and synced recently; else last statement |

---

## Implementation order (suggested)

| # | Task | Depends on |
|---|------|------------|
| 1 | Extract parsers → `services/import/` + unit tests | — |
| 2 | `import_batches` schema + upload API + worker | 1 |
| 3 | Import UI (upload + progress) | 2 |
| 4 | `dedup_fingerprint` column + backfill job | 2 |
| 5 | Account matching + merge API + confirmation UI | 2, Plaid link |
| 6 | Plaid sync dedup integration | 4, 5 |
| 7 | Onboarding fork (import vs Plaid-first) | 3, 5 |
| 8 | Additional bank CSV/PDF parsers | 1 |

Track tasks in `docs/development/tasks.yaml` when work starts.

---

## Open questions

1. **PDF plugins:** which brokers beyond Fidelity/Schwab for v1?
2. **Options / shorts:** full `InvestmentTxnType` enum in v1 or phase after equity buy/sell?
3. **Household accounts:** merge and dedup scoped per `user_id` or household?
4. **Plaid pricing tier:** confirm whether historical update triggers extra product charges.
5. **Realized P&L:** compute from imported trades in analytics layer, not at import time?

---

## Related docs

- [system-overview.md](system-overview.md) — Plaid sync, reconciliation
- [data-security-compliance.md](data-security-compliance.md) — uploaded file retention
- [product-requirements.md](../design/product-requirements.md) — update KPIs when import path ships
