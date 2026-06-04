# Universal Statement Import Parser

**Status:** Phase A + Wave 1 CSV shipped — see `backend/src/services/import/`  
**Last Updated:** June 2026  
**Parent:** [statement-import-and-plaid-bridge.md](statement-import-and-plaid-bridge.md)

Design for parsing **QFX/OFX, CSV, and PDF** from any supported institution, auto-identifying the account from file content, and routing transactions to the correct store — including **high-volume brokerage** (day trading / swing trading).

---

## Goals

1. **Format-agnostic upload** — user drops files; system detects format and extracts account identity without manual account-key mapping.
2. **All account types** — depository, credit, investment (brokerage, IRA, 401k, HSA, crypto).
3. **Correct transaction routing** — banking activity → `transactions`; trades/dividends/fees → `investment_transactions`.
4. **Scale** — a single monthly brokerage export may contain **thousands** of trades; imports must batch-insert without blocking the API.
5. **Dedup-safe** — stable `external_id` per row; fingerprint for cross-source merge with Plaid later.

---

## Parser pipeline

```
Upload (QFX | OFX | CSV | PDF)
        │
        ▼
┌───────────────────┐
│  Format detector   │  extension + MIME + content sniff
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Format adapter    │  ofx | csv | pdf (institution plugin)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  ParsedStatement   │  account identity + txns + metadata
└─────────┬─────────┘
          │
          ├──────────────────────┐
          ▼                      ▼
   Account resolver        Transaction router
   (match or create)       banking vs investment
          │                      │
          └──────────┬───────────┘
                     ▼
              Batch persist (worker)
```

Each stage is pure and unit-testable. Parsers **never** write to the DB directly.

---

## Core types

```typescript
/** Extracted from file — used to match/create accounts row */
interface ParsedAccountIdentity {
  institutionName: string;           // "Fidelity", "Bank of America"
  institutionId?: string;            // OFX ORG/FID, CSV broker code
  accountIdRaw: string;              // full or partial ACCTID from file
  mask: string;                      // last 4 (or last 4 of hash if encrypted)
  type: "depository" | "credit" | "investment";
  subtype: AccountSubtype;
  officialName?: string;
  currencyCode: string;              // default USD
  /** Stable key for dedup across monthly files: sha256(org + acctIdRaw + type) */
  importAccountKey: string;
}

type AccountSubtype =
  | "checking" | "savings" | "cash" | "money_market"
  | "credit_card"
  | "brokerage" | "401k" | "ira" | "roth_ira" | "hsa" | "crypto";

interface ParsedStatement {
  format: "qfx" | "ofx" | "csv" | "pdf";
  formatVersion?: string;            // e.g. "fidelity-activity-v2"
  sourceFilename: string;
  account: ParsedAccountIdentity;
  periodStart?: string;              // YYYY-MM-DD
  periodEnd?: string;
  openingBalance?: string;
  closingBalance?: string;
  bankingTransactions: ParsedBankingTransaction[];
  investmentTransactions: ParsedInvestmentTransaction[];
  warnings: string[];                // non-fatal parse issues
}

interface ParsedBankingTransaction {
  externalId: string;                // prefixed: qfx:FITID, csv:row-42, pdf:...
  date: string;
  name: string;
  merchantName?: string;
  amount: string;                    // spendflow sign convention
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  category?: string;                 // parser hint; rules engine may override
  pending?: boolean;
  dedupFingerprint: string;
}

interface ParsedInvestmentTransaction {
  externalId: string;
  date: string;
  name: string;                      // "Buy AAPL", "Sell TSLA"
  type: InvestmentTxnType;
  ticker?: string;
  securityName?: string;
  quantity?: string;
  price?: string;
  amount: string;                    // signed cash impact
  fees: string;
  dedupFingerprint: string;
}

type InvestmentTxnType =
  | "buy" | "sell"
  | "buy_to_cover" | "sell_short"      // margin / short
  | "option_buy" | "option_sell" | "option_assignment" | "option_expiration"
  | "dividend" | "interest" | "capital_gain_dist"
  | "contribution" | "withdrawal" | "transfer" | "journal"
  | "fee" | "tax_withholding";
```

---

## Format detection

| Signal | QFX/OFX | CSV | PDF |
|--------|---------|-----|-----|
| Extension | `.qfx`, `.ofx` | `.csv`, `.txt` | `.pdf` |
| Content | `OFXHEADER` or `<OFX>` | header row + delimiter | `%PDF-` |
| Fallback | — | Sniff delimiter `,` `\t` `;` | `pdftotext` first 2KB |

Detector returns `{ format, confidence }`. Low confidence → ask user to confirm format in UI.

---

## Supported institutions (primary user portfolio)

**Day-trading priority (highest volume):** E*TRADE, Fidelity, Webull — implement these three CSV templates first; optimize batch ingest and dedup for thousands of trades per month.

Target brokers for v1 template work.

| Institution | Account types | Best export | Alt formats | History depth | Parser notes |
|-------------|---------------|-------------|-------------|---------------|--------------|
| **Fidelity** ⭐ | Brokerage, 401k, IRA, Roth, HSA | CSV activity + **QFX** | PDF statement | ~5 yr via quarterly CSV pulls (90-day cap per download) | **P0 day-trade** — richest headers; QFX for invest blocks |
| **E*TRADE** ⭐ | Brokerage, IRA | CSV transaction history | PDF, QFX (some) | Several years in one CSV | **P0 day-trade** — multi-year single export; high row counts |
| **Webull** ⭐ | Brokerage, IRA | CSV order export (email) | PDF stmt | All orders incl. cancelled | **P0 day-trade** — filter `Filled` only; async email delivery |
| **Schwab** | Brokerage, IRA (incl. TD legacy) | CSV from History | PDF, OFX | Multi-year via CSV | P1 — skip account-info prefix rows before header |
| **Robinhood** | Brokerage, Roth, crypto | CSV activity report | PDF monthly stmt | Custom date range report (async, ~2 hr) | P1 — `Trans Code` maps to buy/sell/dividend |
| **SoFi** | Money (checking/savings), Invest | CSV for **Money only** | PDF for Invest | 2 yr bank CSV; Invest **PDF-only** | P2 bank CSV + **PDF plugin for Invest** |
| **Coinbase** | Crypto | CSV transaction history (taxes page) | PDF | Per tax year | P2 — `assetType: crypto`; separate from equities |
| **Bank of America** | Checking (4857), Visa credit (7138/2096), auto loan (8034) | **PDF eStmt** (no QFX) | — | Monthly PDFs | `bofa-checking`, `bofa-credit-card`, `bofa-auto-loan` via `pdftotext -layout` |
| **American Express** | Credit | CSV (`Date, Description, Amount` + optional extended columns) | — | Full export | `amex-activity`; minimal 3-column export if filename hints `amex` |
| **Discover** | Credit | CSV (`Trans. Date`, `Post Date`, `Description`, `Amount`, `Category`) | — | Activity download | `discover-activity` |
| **Citi** | Credit | CSV (`Date`, `Description`, `Debit`, `Credit`, `Category`; preamble may include `Card-7016`) | — | Year-to-date / annual | `citi-card-activity`; long dates (`May 27, 2026`) supported |

⭐ = primary day/swing trading brokers (user-confirmed).

### Day-trading import requirements (E*TRADE, Fidelity, Webull)

| Requirement | Why |
|-------------|-----|
| **Same-day round trips stay distinct** | Fingerprint includes `type` + `quantity` + `price` — a buy and sell of same symbol same day must not merge |
| **Batch size 500–1000** | Active months may be 500–5,000+ rows per account |
| **Stable broker reference IDs** | Prefer E*TRADE/Fidelity confirmation IDs over synthetic keys when present |
| **Webull: Filled-only** | Order export includes cancelled/working — import `Status = Filled` (or equivalent) only |
| **Fidelity: multi-file stitch** | 90-day download cap → user uploads many CSVs; parser merges by `importAccountKey` |
| **E*TRADE: wide date CSV** | Often best single pull for multi-year history before splitting by month for incremental |

**Suggested export workflow for your three brokers:**

1. **E*TRADE** — Accounts → Transaction History → max date range → CSV (repeat per account if multiple).
2. **Fidelity** — Activity & Orders → History → custom 90-day windows → CSV per quarter per account.
3. **Webull** — Export Orders (app or desktop) → email CSV per account → filter filled in parser.

### Bulk history workflow (all 7 institutions)

For 5–10 years of day/swing trade history:

1. **E*TRADE + Fidelity + Webull** (day-trade core) — CSV first; upload all files; worker batches by account.
2. **Schwab + Robinhood** — CSV activity reports when needed for swing/retirement accounts.
3. **SoFi Invest** — PDF monthly statements → `sofi-invest` PDF plugin (no native CSV).
4. **Fidelity / E*TRADE / Webull (historical PDF only)** — client statement PDFs via `pdftotext -layout`:
   - **E*TRADE** — `etrade-statement`: ACTIVITY section (buys/sells, transfers, RSU).
   - **Webull** — `webull-statement`: summary trade grid + legacy Apex BOUGHT/SOLD rows.
   - **Fidelity** — `fidelity-year-end`: pending settlement trades per account; year-end reports rarely include full trade history — prefer Activity CSV when available.
5. **Coinbase** — CSV per tax year from transaction history export.

### Coinbase (crypto-specific)

- Route to `accounts.subtype = 'crypto'`, `securities.assetType = 'crypto'`.
- Transaction types: `buy`, `sell`, `transfer`, `staking_reward`, `fee` (map from Coinbase `Transaction Type`).
- Quantity may be fractional (8 decimal places — schema already supports `numeric(20,8)`).
- Do **not** mix with equity P&L views unless user opts in.

### SoFi split

| Product | Import path |
|---------|-------------|
| SoFi Checking / Savings | `sofi-checking` CSV template → `transactions` |
| SoFi Invest | PDF plugin only (v1) → `investment_transactions` |

### Implementation priority (templates)

| Wave | Templates | Rationale |
|------|-----------|-----------|
| **Wave 1** | `fidelity-activity`, `etrade-transactions`, `webull-orders` | **Day-trading core** — highest trade volume |
| **Wave 2** | `schwab-transactions`, `robinhood-activity`, OFX invest | Secondary brokers + QFX fallback |
| **Wave 3** | `coinbase-tx-history`, `sofi-checking`, PDF: `sofi-invest`, `etrade-statement`, `webull-statement`, `fidelity-year-end` | Crypto, SoFi, broker PDF fallbacks |

### Fixture request (Wave 1 first)

Sanitized samples needed to implement Wave 1:

| Broker | What to export |
|--------|----------------|
| **E*TRADE** | One CSV transaction history (header + a few trades; redact account #) |
| **Fidelity** | One quarterly CSV from Activity & Orders |
| **Webull** | One emailed order-export CSV (filled trades) |

---

## Account auto-identification by format

### QFX / OFX (preferred — richest metadata)

OFX files can contain **multiple accounts**; each file is split into one `ParsedStatement` per account block.

| OFX section | Account type | Identity fields |
|-------------|--------------|-----------------|
| `BANKACCTFROM` + `STMTRS` | depository | `BANKID`, `ACCTID`, `ACCTTYPE` (CHECKING/SAVINGS) |
| `CCACCTFROM` + `STMTRS` | credit | `ACCTID`, card name in `DESC` |
| `INVACCTFROM` + `INVSTMTRS` | investment | `ACCTID`, `BROKERID`, holdings in `INVPOS` |

**Institution name:** `FI.ORG`, `FI.FID`, or `<ORG>` in sign-on.

**Subtype mapping:**

| OFX `ACCTTYPE` / context | SpendFlow subtype |
|--------------------------|-------------------|
| CHECKING | checking |
| SAVINGS, MONEYMRKT | savings / money_market |
| CREDITLINE, CREDITCARD | credit_card |
| INVESTMENT + brokerage context | brokerage |
| INVESTMENT + IRA keywords in name | ira / roth_ira / 401k |

**Mask:** last 4 of `ACCTID` (never store full account number in logs).

### CSV (broker / bank export templates)

1. **Template registry** — match header row against known profiles:

   | Template ID | Detected by headers | Institution |
   |-------------|---------------------|-------------|
   | `fidelity-activity` | `Run Date`, `Action`, `Symbol`, `Quantity`, `Price`, `Amount` | Fidelity |
   | `schwab-transactions` | `Date`, `Action`, `Symbol`, `Description`, `Quantity`, `Price` | Charles Schwab |
   | `etrade-transactions` | `TransactionDate`, `TransactionType`, `Symbol`, `Quantity`, `Price` | E*TRADE |
   | `robinhood-activity` | `Activity Date`, `Process Date`, `Settle Date`, `Instrument`, `Trans Code` | Robinhood |
   | `webull-orders` | `Name`, `Symbol`, `Side`, `Status`, `Filled`, `Avg Price` | Webull |
   | `sofi-checking` | `Date`, `Description`, `Type`, `Amount`, `Balance` | SoFi Money (bank) |
   | `coinbase-tx-history` | `Timestamp`, `Transaction Type`, `Asset`, `Quantity`, `Spot Price`, `Subtotal` | Coinbase |
   | `ibkr-flex` | `ClientAccountID`, `Symbol`, `Buy/Sell`, `Quantity` | Interactive Brokers |
   | `generic-bank-csv` | `Date`, `Description`, `Amount` | fallback |

2. **Account identity from CSV:**
   - Explicit column: `Account Number`, `Account Name`, `ClientAccountID`
   - Filename pattern: `Fidelity_3301_2024-01.csv`
   - First data row metadata (some exports)
   - If missing → prompt user once; save mapping to `import_account_aliases` for future files

3. **Row routing:**
   - Rows with `Symbol` + `Quantity` + buy/sell action → `investment_transactions`
   - Rows with only description + amount → `transactions` (ACH, wire, cash mgmt)

### PDF (institution plugins)

PDF has no standard schema. Use a **plugin registry**:

```
pdf/
  detect-institution.ts    # first-page fingerprint
  bofa-credit-card.ts      # existing logic from import-statements.ts
  bofa-savings.ts
  fidelity-brokerage.ts
  schwab-brokerage.ts
  etrade-brokerage.ts
  webull-brokerage.ts
  sofi-invest.ts           # SoFi Invest has no CSV — PDF only
  robinhood-statement.ts
  coinbase-statement.ts
  generic-table-extract.ts # last resort: column-aligned regex
```

**Detection:** regex on extracted text (first 2 pages):

- `Bank of America` + `Account #` → `bofa-*`
- `Fidelity Investments` + `Individual` → `fidelity-brokerage`
- `Charles Schwab` → `schwab-brokerage`
- `E\*TRADE` / `Morgan Stanley` → `etrade-brokerage`
- `Webull` → `webull-brokerage`
- `SoFi Securities` / `SoFi Invest` → `sofi-invest`
- `Robinhood` → `robinhood-statement`
- `Coinbase` → `coinbase-statement`

**Account identity from PDF:**

- Statement header: `Account # ****7138`, `Account ending in 4857`
- Brokerage: account name + mask in header/footer

If detection fails → UI shows extracted table preview + manual column mapping (save as custom template).

---

## Transaction routing rules

| Activity | Table | Examples |
|----------|-------|----------|
| Card purchases, bills, income | `transactions` | Amazon, payroll, utilities |
| CC payments, Zelle, internal xfer | `transactions` (`is_transfer`) | Autopay, P2P |
| ACH / wire **into** brokerage | `transactions` (transfer) | "ACH DEPOSIT FIDELITY" on checking |
| Buy / sell / short / cover | `investment_transactions` | AAPL 100 @ 182.50 |
| Dividends, interest in brokerage | `investment_transactions` | `type: dividend` |
| 401k / IRA contribution | `investment_transactions` | `type: contribution` |
| Broker fees, ADR fees | `investment_transactions` | `type: fee` |
| Journal / ACAT between accounts | `investment_transactions` (`type: transfer`) | ACAT, internal journal |

**Do not** double-count: a cash deposit to brokerage appears once on checking (transfer out) and optionally as `contribution` on brokerage — reconciliation engine links these pairs (existing transfer logic extended for investment accounts).

---

## Brokerage / day-trading specifics

### Volume

| Concern | Approach |
|---------|----------|
| 5k–50k trades/month | Worker job; `INSERT` batches of 500–1000 rows |
| API timeout | Upload returns `batchId` immediately; poll status |
| Memory | Stream-parse CSV; OFX block-by-block |
| Index pressure | Defer secondary indexes if needed; use `ON CONFLICT DO NOTHING` |

### Identity for trades

Prefer broker-provided IDs when present:

| Source | external_id |
|--------|-------------|
| Fidelity CSV | `csv:fidelity:{Run Date}:{Reference Number}` |
| Schwab | `csv:schwab:{Transaction ID}` |
| OFX INVEST | `ofx:{FITID}` |
| PDF (no ID) | `pdf:{date}:{ticker}:{side}:{qty}:{price}:{row}` |

**Dedup fingerprint for investments** (must distinguish same-day round trips):

```
sha256(account_id | date | ticker | type | quantity | price | amount)
```

Include `type` so a buy and sell same day same symbol are **not** collapsed.

### Types beyond buy/hold

Day traders need expanded `InvestmentTxnType` (see types above). Schema column `investment_transactions.type` is plain text — no migration required for new type strings.

**Options:** parse `Symbol` like `AAPL 240621C00180000` → store full symbol; set `assetType: option` on security row.

**P&L / wash sales / lot matching:** out of scope for import parser — downstream analytics job consumes raw trades.

### Holdings snapshot (optional per statement)

OFX `INVPOS` / statement summary may include positions at period end. Persist to `holdings` when present (upsert by `account_id + security_id`). Trades remain source of truth for activity; holdings for reconciliation checks.

---

## OFX example: investment block

```xml
<INVSTMTMSGSRSV1>
  <INVSTMTTRNRS>
    <INVSTMTRS>
      <INVACCTFROM>
        <BROKERID>Fidelity</BROKERID>
        <ACCTID>*****3301</ACCTID>
      </INVACCTFROM>
      <INVTRANLIST>
        <STMTTRN>
          <TRNTYPE>BUY</TRNTYPE>
          <DTPOSTED>20240315120000</DTPOSTED>
          <FITID>20240315123456789</FITID>
          <NAME>BUY AAPL</NAME>
          <MEMO>APPLE INC</MEMO>
          <TRNAMT>-18250.00</TRNAMT>
          <UNITS>100</UNITS>
          <UNITPRICE>182.50</UNITPRICE>
          <TICKER>AAPL</TICKER>
        </STMTTRN>
        <!-- ... hundreds more for active traders ... -->
      </INVTRANLIST>
    </INVSTMTRS>
  </INVSTMTTRNRS>
</INVSTMTMSGSRSV1>
```

Parser maps `TRNTYPE` → `InvestmentTxnType`, upserts `securities` by ticker, batches inserts.

---

## Module layout (implementation)

```
backend/src/services/import/
  index.ts                    # parseFile(buffer, filename) → ParsedStatement[]
  detect-format.ts
  types.ts
  account-resolver.ts         # importAccountKey → accounts.id
  fingerprint.ts
  persist/
    banking-batch.ts          # → transactions
    investment-batch.ts       # → investment_transactions + securities
  adapters/
    ofx/
      parse-ofx.ts            # split multi-account
      map-bank-transaction.ts
      map-invest-transaction.ts
    csv/
      detect-template.ts
      templates/
        fidelity-activity.ts
        schwab-transactions.ts
        etrade-transactions.ts
        robinhood-activity.ts
        webull-orders.ts
        sofi-checking.ts
        coinbase-tx-history.ts
        generic-bank.ts
    pdf/
      detect-institution.ts
      plugins/
        bofa-credit-card.ts
        bofa-savings.ts
        fidelity-brokerage.ts
        schwab-brokerage.ts
        etrade-brokerage.ts
        webull-brokerage.ts
        sofi-invest.ts
        robinhood-statement.ts
        coinbase-statement.ts
```

CLI `import-statements.ts` becomes a thin wrapper calling `parseFile` + persist.

---

## User experience

1. **Bulk upload** — drag 120 monthly PDFs + 10 years of QFX; system groups by detected account.
2. **Review screen** — before commit:
   - “Detected: **Fidelity Brokerage ••3301** (investment) — 4,812 trades, Mar 2024”
   - “Detected: **BofA Credit ••7138** (credit) — 87 transactions, Mar 2024”
   - Warnings: “3 rows skipped (unrecognized option symbol)”
3. **Confirm or fix** — merge with existing account if match score high; else create new.
4. **Progress** — per-file status in worker; email/toast when batch completes.

---

## Testing strategy

| Layer | Tests |
|-------|-------|
| Format detection | fixture files per extension |
| OFX | multi-account file, bank + invest in same file |
| CSV templates | golden files from Fidelity/Schwab (sanitized) |
| PDF plugins | text fixtures from `pdftotext` output |
| Volume | 10k row CSV completes < 30s in worker |
| Routing | ACH on checking vs buy on brokerage |
| Dedup | re-import same month → 0 new rows |

Store fixtures under `backend/src/services/import/__fixtures__/` (gitignored if real statements; use synthetic).

---

## Phased delivery

| Phase | Scope |
|-------|-------|
| **P0** | CSV `fidelity-activity`, `etrade-transactions`, `webull-orders` (day-trade core) + batch worker |
| **P1** | OFX/QFX invest; `schwab-transactions`, `robinhood-activity` |
| **P2** | CSV `coinbase-tx-history`, `sofi-checking`; PDF `sofi-invest`, fallbacks |
| **P3** | Custom CSV column mapper; options symbols; holdings snapshot |
| **P4** | Plaid cross-source dedup for investment txns (same fingerprint rules) |

---

## Related

- DB: `accounts`, `transactions`, `investment_transactions`, `securities`, `holdings` — [schema.ts](../../backend/src/db/schema.ts)
- Existing CLI: [import-statements.ts](../../backend/scripts/import-statements.ts)
- Investments API: [investments-store.ts](../../backend/src/services/investments-store.ts)
