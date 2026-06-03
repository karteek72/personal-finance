/**
 * Deterministic SpendFlow demo dataset generator.
 *
 * One source of truth -> writes BOTH pipelines:
 *   - ../mock/*.json              (raw rows for `npm run db:seed` -> Postgres)
 *   - ../ui/src/mocks/*.json      (API-shaped fixtures for NEXT_PUBLIC_USE_MOCKS=true)
 *
 * Run from backend/:  npm run db:gen-mock
 *
 * The dataset covers a single rich persona (+ linked household partner):
 *   - 11 accounts: checking, savings (HYSA), cash, 3 credit cards (one overdue),
 *     brokerage, Roth IRA, 401k, crypto, HSA.
 *   - ~14 months of transactions (Apr 2025 -> May 2026) for MoM + YoY,
 *     with edge cases: pending, transfers, CC payments, refunds, duplicate
 *     charges, large/unusual purchases, ATM/overdraft/late fees, salary +
 *     side income, subscription price increase, investment buys/sells/dividends/
 *     contributions.
 *   - Derived feature fixtures for every preview feature.
 *
 * Scripts are not part of `tsc` build (tsconfig include = src/**). Run via tsx.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/* ----------------------------- helpers ----------------------------- */

const MOCK_ROOT = resolve(process.cwd(), "../mock");
const UI_MOCK_ROOT = resolve(process.cwd(), "../ui/src/mocks");

/** Deterministic PRNG (mulberry32). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260603);
const rand = (min: number, max: number): number => min + rng() * (max - min);
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;
const chance = (p: number): boolean => rng() < p;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const m = (n: number): string => round2(n).toFixed(2);
const pad = (n: number, w = 2): string => String(n).padStart(w, "0");
const hex = (n: number, w: number): string => n.toString(16).padStart(w, "0");

const TODAY = { y: 2026, mo: 6, d: 3 };
const dateStr = (y: number, mo: number, d: number): string =>
  `${y}-${pad(mo)}-${pad(d)}`;
const monthKey = (y: number, mo: number): string => `${y}-${pad(mo)}`;
const daysInMonth = (y: number, mo: number): number => new Date(y, mo, 0).getDate();
const dowOf = (y: number, mo: number, d: number): number => new Date(y, mo - 1, d).getDay();

function writeJson(root: string, file: string, data: unknown): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(resolve(root, file), `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

/* ----------------------------- ids ----------------------------- */

const acctId = (n: number): string => `a1b2c3d4-e5f6-4789-a012-3456789010${pad(n)}`;
const txnId = (n: number): string => `b0000000-0000-4000-8000-${hex(n, 12)}`;
const invTxnId = (n: number): string => `d0000000-0000-4000-8000-${hex(n, 12)}`;
const secId = (n: number): string => `c0000000-0000-4000-8000-${hex(n, 12)}`;
const itemId = (n: number): string => `00000000-0000-4000-8000-0000000000${pad(20 + n)}`;

const DEV_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "personal@spendflow.local",
  displayName: "Alex Rivera",
  googleSub: null as string | null,
};
const PARTNER_USER = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "partner@spendflow.local",
  displayName: "Sam Rivera",
  googleSub: null as string | null,
};

/* ----------------------------- categories ----------------------------- */

const C = {
  groceries: "Food & Groceries",
  dining: "Dining & Restaurants",
  housing: "Housing & Home",
  utilities: "Utilities & Bills",
  transport: "Transportation",
  subs: "Subscriptions & Software",
  finance: "Financial & Insurance",
  health: "Health & Medical",
  shopping: "Shopping & Retail",
  entertainment: "Entertainment",
  personal: "Personal Care",
  travel: "Travel",
  income: "Income",
  transfers: "Transfers (internal)",
};

/* ----------------------------- accounts ----------------------------- */

type AcctType = "depository" | "credit" | "investment";
interface AcctDef {
  id: string;
  name: string;
  officialName: string;
  type: AcctType;
  subtype: string;
  mask: string;
  institutionName: string;
  source: "plaid" | "import";
  itemKey: string | null;
  balanceCurrent: number;
  balanceAvailable: number | null;
  status: "active" | "error" | "reauth_required";
}

const ACCOUNTS: AcctDef[] = [
  { id: acctId(1), name: "Everyday Checking", officialName: "BofA Advantage Banking", type: "depository", subtype: "checking", mask: "4471", institutionName: "Bank of America", source: "plaid", itemKey: "bofa", balanceCurrent: 4218.55, balanceAvailable: 4218.55, status: "active" },
  { id: acctId(2), name: "Ally Savings", officialName: "Ally Online Savings", type: "depository", subtype: "savings", mask: "8820", institutionName: "Ally Bank", source: "plaid", itemKey: "ally", balanceCurrent: 9240.0, balanceAvailable: 9240.0, status: "active" },
  { id: acctId(3), name: "Apple Cash", officialName: "Apple Cash", type: "depository", subtype: "cash management", mask: "2210", institutionName: "Apple", source: "import", itemKey: null, balanceCurrent: 612.4, balanceAvailable: 612.4, status: "active" },
  { id: acctId(4), name: "Chase Sapphire", officialName: "Chase Sapphire Preferred", type: "credit", subtype: "credit card", mask: "4521", institutionName: "Chase", source: "plaid", itemKey: "chase", balanceCurrent: 1845.23, balanceAvailable: 8154.77, status: "active" },
  { id: acctId(5), name: "Amex Gold", officialName: "American Express Gold Card", type: "credit", subtype: "credit card", mask: "1009", institutionName: "American Express", source: "plaid", itemKey: "amex", balanceCurrent: 2380.66, balanceAvailable: 7619.34, status: "active" },
  { id: acctId(6), name: "Citi Double Cash", officialName: "Citi Double Cash Card", type: "credit", subtype: "credit card", mask: "7732", institutionName: "Citi", source: "plaid", itemKey: "citi", balanceCurrent: 940.12, balanceAvailable: 4059.88, status: "active" },
  { id: acctId(7), name: "Fidelity Brokerage", officialName: "Fidelity Individual Brokerage", type: "investment", subtype: "brokerage", mask: "3301", institutionName: "Fidelity", source: "plaid", itemKey: "fidelity", balanceCurrent: 0, balanceAvailable: null, status: "active" },
  { id: acctId(8), name: "Vanguard Roth IRA", officialName: "Vanguard Roth IRA", type: "investment", subtype: "roth_ira", mask: "5567", institutionName: "Vanguard", source: "plaid", itemKey: "vanguard", balanceCurrent: 0, balanceAvailable: null, status: "active" },
  { id: acctId(9), name: "Fidelity 401(k)", officialName: "Fidelity Workplace 401(k)", type: "investment", subtype: "401k", mask: "9912", institutionName: "Fidelity", source: "import", itemKey: null, balanceCurrent: 0, balanceAvailable: null, status: "active" },
  { id: acctId(10), name: "Coinbase", officialName: "Coinbase Portfolio", type: "investment", subtype: "crypto", mask: "0xA1", institutionName: "Coinbase", source: "plaid", itemKey: "coinbase", balanceCurrent: 0, balanceAvailable: null, status: "reauth_required" },
  { id: acctId(11), name: "Fidelity HSA", officialName: "Fidelity Health Savings Account", type: "investment", subtype: "hsa", mask: "6604", institutionName: "Fidelity", source: "plaid", itemKey: "fidelity", balanceCurrent: 3180.0, balanceAvailable: null, status: "active" },
];
const ACC = Object.fromEntries(ACCOUNTS.map((a) => [a.subtype, a.id])) as Record<string, string>;
const CHECKING = ACCOUNTS[0]!.id;
const SAVINGS = ACCOUNTS[1]!.id;
const CASH = ACCOUNTS[2]!.id;
const CHASE = ACCOUNTS[3]!.id;
const AMEX = ACCOUNTS[4]!.id;
const CITI = ACCOUNTS[5]!.id;
const BROKERAGE = ACCOUNTS[6]!.id;
const ROTH = ACCOUNTS[7]!.id;
const K401 = ACCOUNTS[8]!.id;
const CRYPTO = ACCOUNTS[9]!.id;

const CREDIT_CARDS = [CHASE, AMEX, CITI];

/* ----------------------------- securities & holdings ----------------------------- */

interface SecDef { ticker: string; name: string; assetType: string; sector: string; price: number; }
const SECS: SecDef[] = [
  { ticker: "AAPL", name: "Apple Inc.", assetType: "equity", sector: "Technology", price: 212.4 },
  { ticker: "MSFT", name: "Microsoft Corp.", assetType: "equity", sector: "Technology", price: 431.2 },
  { ticker: "AMZN", name: "Amazon.com Inc.", assetType: "equity", sector: "Consumer Discretionary", price: 186.1 },
  { ticker: "TSLA", name: "Tesla Inc.", assetType: "equity", sector: "Consumer Discretionary", price: 178.9 },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetType: "etf", sector: "Diversified", price: 495.3 },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", assetType: "etf", sector: "Diversified", price: 268.7 },
  { ticker: "VXUS", name: "Vanguard Total International ETF", assetType: "etf", sector: "Diversified", price: 62.1 },
  { ticker: "FXAIX", name: "Fidelity 500 Index Fund", assetType: "mutual_fund", sector: "Diversified", price: 185.4 },
  { ticker: "VBTLX", name: "Vanguard Total Bond Market", assetType: "mutual_fund", sector: "Fixed Income", price: 9.78 },
  { ticker: "BTC", name: "Bitcoin", assetType: "crypto", sector: "Crypto", price: 68120.0 },
  { ticker: "ETH", name: "Ethereum", assetType: "crypto", sector: "Crypto", price: 3412.0 },
];
const secIdByTicker = new Map(SECS.map((s, i) => [s.ticker, secId(i + 1)]));

interface HoldingDef { accountId: string; ticker: string; quantity: number; costBasis: number; }
const HOLDINGS: HoldingDef[] = [
  { accountId: BROKERAGE, ticker: "AAPL", quantity: 40, costBasis: 150.2 },
  { accountId: BROKERAGE, ticker: "VOO", quantity: 15, costBasis: 381.4 },
  { accountId: BROKERAGE, ticker: "MSFT", quantity: 12, costBasis: 301.0 },
  { accountId: BROKERAGE, ticker: "TSLA", quantity: 10, costBasis: 241.5 },
  { accountId: BROKERAGE, ticker: "AMZN", quantity: 8, costBasis: 131.2 },
  { accountId: ROTH, ticker: "VTI", quantity: 30, costBasis: 201.3 },
  { accountId: ROTH, ticker: "VXUS", quantity: 50, costBasis: 55.4 },
  { accountId: K401, ticker: "FXAIX", quantity: 120, costBasis: 141.0 },
  { accountId: K401, ticker: "VBTLX", quantity: 200, costBasis: 10.5 },
  { accountId: CRYPTO, ticker: "BTC", quantity: 0.15, costBasis: 42100.0 },
  { accountId: CRYPTO, ticker: "ETH", quantity: 1.2, costBasis: 2210.0 },
];

const priceOf = (t: string): number => SECS.find((s) => s.ticker === t)!.price;
// set investment account balances from holdings
for (const acc of ACCOUNTS) {
  if (acc.type !== "investment" || acc.subtype === "hsa") continue;
  const total = HOLDINGS.filter((h) => h.accountId === acc.id).reduce(
    (s, h) => s + h.quantity * priceOf(h.ticker),
    0,
  );
  acc.balanceCurrent = round2(total);
}

/* ----------------------------- transaction model ----------------------------- */

interface Txn {
  id: string;
  accountId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number; // expense +, income/refund/credit -
  category: string;
  subCategory: string | null;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
}

const txns: Txn[] = [];
let txnSeq = 0;
function addTxn(t: Omit<Txn, "id">): Txn {
  txnSeq += 1;
  const row: Txn = { id: txnId(txnSeq), ...t };
  txns.push(row);
  return row;
}

// months Apr 2025 -> May 2026 (14)
const months: Array<{ y: number; mo: number }> = [];
for (let i = 0; i < 14; i++) {
  const base = new Date(2025, 3 + i, 1);
  months.push({ y: base.getFullYear(), mo: base.getMonth() + 1 });
}

const SALARY_BEFORE = 3260; // per semi-monthly paycheck (pre-2026 raise)
const SALARY_AFTER = 3358; // ~3% raise from Jan 2026

const GROCERS = ["Whole Foods Market", "Trader Joe's", "Costco Wholesale", "Safeway"];
const RESTAURANTS = ["Sweetgreen", "Chipotle", "Tacos El Gordo", "Ramen Nagi", "The Cheesecake Factory", "Olive Garden"];
const DELIVERY = ["Uber Eats", "DoorDash"];
const COFFEE = ["Starbucks", "Blue Bottle Coffee", "Philz Coffee"];
const RIDESHARE = ["Uber", "Lyft"];
const GAS = ["Shell", "Chevron"];
const SHOPS = ["Amazon", "Target", "Best Buy", "Nike"];
const ENTERTAIN = ["AMC Theatres", "Steam", "Ticketmaster"];

function recurringFor(y: number, mo: number): void {
  const key = monthKey(y, mo);
  const netflix = key >= "2026-01" ? 15.49 : 13.99;
  const recs: Array<[number, string, string, number, string, string | null, "expense"]> = [
    [1, "Greystar Apartments", CHECKING, 1850, C.housing, "Mortgage / Rent", "expense"],
    [8, "ConEdison", CHECKING, round2(rand(96, 138)), C.utilities, "Electricity", "expense"],
    [10, "Verizon Fios", CHECKING, 79.99, C.utilities, "Internet", "expense"],
    [12, "T-Mobile", CHECKING, 85.0, C.utilities, "Phone", "expense"],
    [20, "GEICO Insurance", CHECKING, 142.0, C.finance, "Auto Insurance", "expense"],
    [6, "Equinox", CHECKING, 24.99, C.health, "Fitness", "expense"],
    [3, "Netflix", CHASE, netflix, C.subs, "Streaming", "expense"],
    [5, "Spotify", CHASE, 11.99, C.subs, "Music", "expense"],
    [14, "Disney+", CHASE, 13.99, C.subs, "Streaming", "expense"],
    [18, "Adobe Creative Cloud", AMEX, 54.99, C.subs, "Software", "expense"],
    [2, "Apple iCloud+", CASH, 2.99, C.subs, "Cloud Storage", "expense"],
  ];
  for (const [day, merchant, account, amount, category, sub] of recs) {
    addTxn({
      accountId: account,
      date: dateStr(y, mo, day),
      name: merchant.toUpperCase(),
      merchantName: merchant,
      amount,
      category,
      subCategory: sub,
      transactionType: "expense",
      isTransfer: false,
      pending: false,
    });
  }
}

function variableFor(y: number, mo: number): void {
  const dim = daysInMonth(y, mo);
  const isCurrent = y === TODAY.y && mo === TODAY.mo - 1; // May 2026 = latest full month
  const spendCard = (): string => pick(CREDIT_CARDS);
  const weekendBias = (): number => {
    // pick a day, weighting weekends to create day-of-week pattern
    for (let tries = 0; tries < 4; tries++) {
      const d = randInt(1, dim);
      const dow = dowOf(y, mo, d);
      if (dow === 0 || dow === 6 || chance(0.5)) return d;
    }
    return randInt(1, dim);
  };

  const emit = (
    count: number,
    merchants: string[],
    category: string,
    sub: string | null,
    lo: number,
    hi: number,
    accountFn: () => string,
  ): void => {
    for (let i = 0; i < count; i++) {
      const merchant = pick(merchants);
      addTxn({
        accountId: accountFn(),
        date: dateStr(y, mo, weekendBias()),
        name: merchant,
        merchantName: merchant,
        amount: round2(rand(lo, hi)),
        category,
        subCategory: sub,
        transactionType: "expense",
        isTransfer: false,
        pending: false,
      });
    }
  };

  emit(randInt(6, 9), GROCERS, C.groceries, "Grocery Stores", 38, 165, spendCard);
  emit(randInt(8, 13), RESTAURANTS, C.dining, "Sit-down Restaurants", 18, 78, spendCard);
  emit(randInt(4, 7), DELIVERY, C.dining, "Food Delivery", 22, 54, spendCard);
  emit(randInt(12, 18), COFFEE, C.dining, "Coffee Shops", 4.5, 8.5, () => (chance(0.4) ? CASH : spendCard()));
  emit(randInt(5, 9), RIDESHARE, C.transport, "Rideshare", 11, 38, spendCard);
  emit(randInt(2, 4), GAS, C.transport, "Gas", 32, 64, () => CHASE);
  emit(randInt(3, 6), SHOPS, C.shopping, "General Merchandise", 18, 220, spendCard);
  emit(randInt(1, 3), ENTERTAIN, C.entertainment, "Movies & Events", 14, 60, spendCard);
  if (chance(0.6)) emit(randInt(1, 2), ["CVS Pharmacy", "Walgreens"], C.health, "Pharmacy", 9, 48, spendCard);
  if (chance(0.5)) emit(1, ["Sephora", "Ulta Beauty"], C.personal, "Beauty", 24, 96, spendCard);

  // income (semi-monthly direct deposit)
  const pay = key2026(y, mo) ? SALARY_AFTER : SALARY_BEFORE;
  for (const day of [1, 15]) {
    addTxn({
      accountId: CHECKING,
      date: dateStr(y, mo, day),
      name: "ACME ROBOTICS DIRECT DEP",
      merchantName: "Acme Robotics",
      amount: -pay,
      category: C.income,
      subCategory: "Salary",
      transactionType: "income",
      isTransfer: false,
      pending: false,
    });
  }
  // side income some months
  if (chance(0.45)) {
    addTxn({
      accountId: CHECKING,
      date: dateStr(y, mo, randInt(8, 24)),
      name: "STRIPE TRANSFER — FREELANCE",
      merchantName: "Freelance (Stripe)",
      amount: -round2(rand(180, 620)),
      category: C.income,
      subCategory: "Side Income",
      transactionType: "income",
      isTransfer: false,
      pending: false,
    });
  }

  // transfers (excluded from spend)
  addTxn({
    accountId: CHECKING,
    date: dateStr(y, mo, 2),
    name: "TRANSFER TO ALLY SAVINGS",
    merchantName: "Ally Bank",
    amount: 1000,
    category: C.transfers,
    subCategory: "Savings Transfer",
    transactionType: "transfer",
    isTransfer: true,
    pending: false,
  });
  // credit card payments
  for (const card of CREDIT_CARDS) {
    addTxn({
      accountId: CHECKING,
      date: dateStr(y, mo, 6),
      name: "CREDIT CARD PAYMENT",
      merchantName: "Card Payment",
      amount: round2(rand(700, 1800)),
      category: C.transfers,
      subCategory: "Credit Card Payment",
      transactionType: "transfer",
      isTransfer: true,
      pending: false,
    });
    void card;
  }

  // -------- edge cases --------
  // refund (negative expense)
  if (chance(0.4)) {
    addTxn({
      accountId: spendCard(),
      date: dateStr(y, mo, randInt(10, 26)),
      name: "AMAZON REFUND",
      merchantName: "Amazon",
      amount: -round2(rand(18, 95)),
      category: C.shopping,
      subCategory: "Refund",
      transactionType: "expense",
      isTransfer: false,
      pending: false,
    });
  }
  // duplicate charge within 48h
  if (chance(0.3)) {
    const d = randInt(5, dim - 2);
    const amt = round2(rand(28, 46));
    for (const dd of [d, d + 1]) {
      addTxn({
        accountId: CHASE,
        date: dateStr(y, mo, dd),
        name: "DOORDASH",
        merchantName: "DoorDash",
        amount: amt,
        category: C.dining,
        subCategory: "Food Delivery",
        transactionType: "expense",
        isTransfer: false,
        pending: false,
      });
    }
  }
  // ATM / overdraft / late fees (money leaks)
  if (chance(0.5)) {
    addTxn({
      accountId: CHECKING,
      date: dateStr(y, mo, randInt(3, 26)),
      name: "ATM WITHDRAWAL FEE",
      merchantName: "Out-of-network ATM",
      amount: 3.5,
      category: C.finance,
      subCategory: "Bank Fees",
      transactionType: "expense",
      isTransfer: false,
      pending: false,
    });
  }
  if (chance(0.15)) {
    addTxn({
      accountId: CHECKING,
      date: dateStr(y, mo, randInt(3, 26)),
      name: "OVERDRAFT FEE",
      merchantName: "Bank of America",
      amount: 35,
      category: C.finance,
      subCategory: "Bank Fees",
      transactionType: "expense",
      isTransfer: false,
      pending: false,
    });
  }

  void isCurrent;
}

function key2026(y: number, mo: number): boolean {
  return monthKey(y, mo) >= "2026-01";
}

// large/unusual one-off purchases on specific months
const ONE_OFFS: Array<{ key: string; day: number; account: string; merchant: string; amount: number; category: string; sub: string }> = [
  { key: "2025-07", day: 14, account: CHASE, merchant: "Delta Air Lines", amount: 612.4, category: C.travel, sub: "Flights" },
  { key: "2025-07", day: 16, account: CHASE, merchant: "Airbnb", amount: 884.0, category: C.travel, sub: "Lodging" },
  { key: "2025-11", day: 28, account: AMEX, merchant: "Best Buy", amount: 1299.0, category: C.shopping, sub: "Electronics" },
  { key: "2026-03", day: 9, account: AMEX, merchant: "Apple Store", amount: 2199.0, category: C.shopping, sub: "Electronics" },
  { key: "2026-04", day: 21, account: CHASE, merchant: "Delta Air Lines", amount: 528.0, category: C.travel, sub: "Flights" },
];

for (const { y, mo } of months) {
  recurringFor(y, mo);
  variableFor(y, mo);
  for (const o of ONE_OFFS.filter((x) => x.key === monthKey(y, mo))) {
    addTxn({
      accountId: o.account,
      date: dateStr(y, mo, o.day),
      name: o.merchant.toUpperCase(),
      merchantName: o.merchant,
      amount: o.amount,
      category: o.category,
      subCategory: o.sub,
      transactionType: "expense",
      isTransfer: false,
      pending: false,
    });
  }
}

// pending transactions (early June 2026)
const pendingDefs: Array<[string, string, number, string, string]> = [
  ["Whole Foods Market", CHASE, 73.21, C.groceries, "Grocery Stores"],
  ["Uber", AMEX, 24.8, C.transport, "Rideshare"],
  ["Blue Bottle Coffee", CASH, 6.5, C.dining, "Coffee Shops"],
];
for (const [merchant, account, amount, category, sub] of pendingDefs) {
  addTxn({
    accountId: account,
    date: dateStr(2026, 6, randInt(1, 3)),
    name: merchant,
    merchantName: merchant,
    amount,
    category,
    subCategory: sub,
    transactionType: "expense",
    isTransfer: false,
    pending: true,
  });
}

// sort chronological then assign stable ids already done; re-sort by date desc for output friendliness
txns.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/* ----------------------------- investment transactions ----------------------------- */

interface InvTxn {
  id: string;
  accountId: string;
  ticker: string | null;
  date: string;
  name: string;
  type: "buy" | "sell" | "dividend" | "contribution" | "fee";
  quantity: number | null;
  price: number | null;
  amount: number;
  fees: number;
}
const invTxns: InvTxn[] = [];
let invSeq = 0;
const addInv = (t: Omit<InvTxn, "id">): void => {
  invSeq += 1;
  invTxns.push({ id: invTxnId(invSeq), ...t });
};

for (const { y, mo } of months) {
  // 401k + Roth contributions monthly
  addInv({ accountId: K401, ticker: "FXAIX", date: dateStr(y, mo, 1), name: "401(k) Contribution", type: "contribution", quantity: round2(rand(7, 9)), price: priceOf("FXAIX"), amount: 1500, fees: 0 });
  addInv({ accountId: ROTH, ticker: "VTI", date: dateStr(y, mo, 3), name: "Roth IRA Contribution", type: "contribution", quantity: round2(rand(1.6, 2)), price: priceOf("VTI"), amount: 500, fees: 0 });
  // periodic brokerage buys
  if (chance(0.6)) {
    const s = pick(["AAPL", "VOO", "MSFT", "AMZN"]);
    const qty = round2(rand(1, 4));
    addInv({ accountId: BROKERAGE, ticker: s, date: dateStr(y, mo, randInt(10, 24)), name: `Buy ${s}`, type: "buy", quantity: qty, price: priceOf(s), amount: round2(qty * priceOf(s)), fees: 0 });
  }
  // quarterly dividends
  if ([6, 9, 12, 3].includes(mo)) {
    addInv({ accountId: BROKERAGE, ticker: "VOO", date: dateStr(y, mo, 18), name: "VOO Dividend", type: "dividend", quantity: null, price: null, amount: round2(rand(28, 52)), fees: 0 });
  }
}
// one sell (TSLA trim, a loss)
addInv({ accountId: BROKERAGE, ticker: "TSLA", date: "2026-02-12", name: "Sell TSLA", type: "sell", quantity: 3, price: 192.0, amount: 576.0, fees: 0 });

/* ----------------------------- derivations ----------------------------- */

const spendMonths = months.map(({ y, mo }) => monthKey(y, mo));
const latestMonth = "2026-05";

function isSpend(t: Txn): boolean {
  return t.transactionType === "expense" && !t.isTransfer;
}
function isIncome(t: Txn): boolean {
  return t.transactionType === "income" && !t.isTransfer;
}

// monthly aggregates
interface MonthAgg { month: string; expenses: number; income: number; net: number; }
const monthAgg = new Map<string, MonthAgg>();
for (const mk of spendMonths) monthAgg.set(mk, { month: mk, expenses: 0, income: 0, net: 0 });
for (const t of txns) {
  if (t.pending) continue;
  const mk = t.date.slice(0, 7);
  const agg = monthAgg.get(mk);
  if (!agg) continue;
  if (isSpend(t)) {
    agg.expenses += t.amount;
    agg.net -= t.amount;
  } else if (isIncome(t)) {
    agg.income += Math.abs(t.amount);
    agg.net += Math.abs(t.amount);
  }
}
const monthlySeries = spendMonths.map((mk) => {
  const a = monthAgg.get(mk)!;
  return { month: mk, income: m(a.income), expenses: m(a.expenses), net: m(a.net) };
});

// category totals for latest month
function categoryTotals(month: string): Array<{ name: string; amount: number }> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.pending || !isSpend(t) || t.date.slice(0, 7) !== month) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}
const latestCats = categoryTotals(latestMonth);
const latestTotal = latestCats.reduce((s, c) => s + c.amount, 0);
function priorCatAmount(month: string, name: string): number {
  return categoryTotals(month).find((c) => c.name === name)?.amount ?? 0;
}
const priorMonth = "2026-04";
const categoriesResponse = {
  categories: latestCats.map((c) => {
    const prior = priorCatAmount(priorMonth, c.name);
    const delta = prior > 0 ? round2(((c.amount - prior) / prior) * 100) : 0;
    return { name: c.name, amount: m(c.amount), percentage: round2((c.amount / latestTotal) * 100), deltaVsPriorMonth: delta };
  }),
};

// trends: top 6 categories across all months
const allCatTotals = new Map<string, number>();
for (const t of txns) {
  if (t.pending || !isSpend(t)) continue;
  allCatTotals.set(t.category, (allCatTotals.get(t.category) ?? 0) + t.amount);
}
const topCats = [...allCatTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
const trendsResponse = {
  trends: topCats.map((name) => ({
    name,
    months: spendMonths.map((mk) => {
      const amt = txns.filter((t) => !t.pending && isSpend(t) && t.category === name && t.date.slice(0, 7) === mk).reduce((s, t) => s + t.amount, 0);
      return { month: mk, amount: m(amt) };
    }),
  })),
};

// summary for latest month
const latestAgg = monthAgg.get(latestMonth)!;
const ccPaymentsExcluded = txns
  .filter((t) => !t.pending && t.isTransfer && t.subCategory === "Credit Card Payment" && t.date.slice(0, 7) === latestMonth)
  .reduce((s, t) => s + t.amount, 0);
const avgMonthlySpend = monthlySeries.reduce((s, r) => s + Number.parseFloat(r.expenses), 0) / monthlySeries.length;
const latestTxnCount = txns.filter((t) => t.date.slice(0, 7) === latestMonth).length;
const summaryResponse = {
  totalSpent: m(latestAgg.expenses),
  income: m(latestAgg.income),
  netSavings: m(latestAgg.net),
  avgMonthlySpend: m(avgMonthlySpend),
  topCategory: { name: latestCats[0]!.name, amount: m(latestCats[0]!.amount) },
  ccPaymentsExcluded: m(ccPaymentsExcluded),
  savingsRate: round2(latestAgg.income > 0 ? (latestAgg.net / latestAgg.income) * 100 : 0),
  transactionCount: latestTxnCount,
  pendingCount: txns.filter((t) => t.pending).length,
  monthsInPeriod: 1,
};

// money flow for latest month
const incomeSources = (() => {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.pending || !isIncome(t) || t.date.slice(0, 7) !== latestMonth) continue;
    map.set(t.merchantName ?? "Income", (map.get(t.merchantName ?? "Income") ?? 0) + Math.abs(t.amount));
  }
  return [...map.entries()].map(([label, amount]) => ({ label, amount: m(amount) }));
})();
const moneyFlowResponse = {
  income: { sources: incomeSources, total: m(latestAgg.income) },
  bankAccounts: {
    accounts: [
      { label: "Everyday Checking", amount: m(latestAgg.expenses * 0.45) },
      { label: "Ally Savings", amount: "1000.00" },
    ],
    transfersOut: "1000.00",
  },
  creditCards: {
    accounts: CREDIT_CARDS.map((id) => {
      const acc = ACCOUNTS.find((a) => a.id === id)!;
      const charges = txns.filter((t) => !t.pending && isSpend(t) && t.accountId === id && t.date.slice(0, 7) === latestMonth).reduce((s, t) => s + t.amount, 0);
      return { label: acc.name, amount: m(charges) };
    }),
    totalCharges: m(
      txns.filter((t) => !t.pending && isSpend(t) && CREDIT_CARDS.includes(t.accountId) && t.date.slice(0, 7) === latestMonth).reduce((s, t) => s + t.amount, 0),
    ),
  },
  monthlySeries,
};

// alerts
const alertsResponse = {
  alerts: [
    { id: "alert-dining", severity: "warning", title: "Dining up 22% this month", message: "You've spent more on restaurants and delivery than your 6-month average.", dismissible: true },
    { id: "alert-large", severity: "info", title: "Large purchase detected", message: "A $2,199.00 Apple Store charge posted in March.", dismissible: true },
    { id: "alert-overdue", severity: "danger", title: "Citi Double Cash payment overdue", message: "The minimum payment was due and is now past due.", dismissible: false },
    { id: "alert-savings", severity: "info", title: "Savings rate holding at 18%", message: "You're on pace with your emergency-fund goal.", dismissible: true },
  ],
};

/* ----- account balances: cash totals & net worth ----- */
const cashAssets = [CHECKING, SAVINGS, CASH].reduce((s, id) => s + ACCOUNTS.find((a) => a.id === id)!.balanceCurrent, 0);
const investAssets = ACCOUNTS.filter((a) => a.type === "investment").reduce((s, a) => s + a.balanceCurrent, 0);
const totalAssets = round2(cashAssets + investAssets);
const totalLiabilities = round2(CREDIT_CARDS.reduce((s, id) => s + ACCOUNTS.find((a) => a.id === id)!.balanceCurrent, 0));
const netWorth = round2(totalAssets - totalLiabilities);

// net worth snapshots (rising trend ending at netWorth)
const nwStart = 61000;
const netWorthSnapshots = spendMonths.map((mk, i) => {
  const frac = i / (spendMonths.length - 1);
  const value = round2(nwStart + (netWorth - nwStart) * frac + (chance(0.5) ? rand(-600, 600) : 0));
  const liab = round2(totalLiabilities + rand(-400, 800));
  return {
    month: mk,
    totalAssets: m(value + liab),
    totalLiabilities: m(liab),
    netWorth: m(value),
    breakdown: [
      { type: "cash", label: "Cash & Savings", value: m(cashAssets * (0.7 + 0.3 * frac)) },
      { type: "investment", label: "Investments", value: m(investAssets * (0.6 + 0.4 * frac)) },
      { type: "credit", label: "Credit Cards", value: m(-liab) },
    ],
  };
});
// ensure last snapshot exact
netWorthSnapshots[netWorthSnapshots.length - 1] = {
  month: latestMonth,
  totalAssets: m(totalAssets),
  totalLiabilities: m(totalLiabilities),
  netWorth: m(netWorth),
  breakdown: [
    { type: "cash", label: "Cash & Savings", value: m(cashAssets) },
    { type: "investment", label: "Investments", value: m(investAssets) },
    { type: "credit", label: "Credit Cards", value: m(-totalLiabilities) },
  ],
};

/* ----- credit liabilities ----- */
const creditLiabilities = [
  { accountId: CHASE, lastStatementBalance: "1845.23", lastStatementIssueDate: "2026-05-15", minimumPaymentAmount: "35.00", nextPaymentDueDate: "2026-06-12", lastPaymentAmount: "1500.00", lastPaymentDate: "2026-05-06", isOverdue: false, purchaseApr: "21.49" },
  { accountId: AMEX, lastStatementBalance: "2380.66", lastStatementIssueDate: "2026-05-18", minimumPaymentAmount: "70.00", nextPaymentDueDate: "2026-06-15", lastPaymentAmount: "900.00", lastPaymentDate: "2026-05-06", isOverdue: false, purchaseApr: "24.99" },
  { accountId: CITI, lastStatementBalance: "940.12", lastStatementIssueDate: "2026-04-30", minimumPaymentAmount: "29.00", nextPaymentDueDate: "2026-05-25", lastPaymentAmount: "0.00", lastPaymentDate: "2026-04-10", isOverdue: true, purchaseApr: "19.24" },
];
const creditLiabilitiesFile = {
  liabilities: creditLiabilities.map((l) => ({
    accountId: l.accountId,
    lastStatementBalance: l.lastStatementBalance,
    lastStatementIssueDate: l.lastStatementIssueDate,
    minimumPaymentAmount: l.minimumPaymentAmount,
    nextPaymentDueDate: l.nextPaymentDueDate,
    lastPaymentAmount: l.lastPaymentAmount,
    lastPaymentDate: l.lastPaymentDate,
    isOverdue: l.isOverdue,
    aprs: [{ apr_type: "purchase", apr_percentage: Number.parseFloat(l.purchaseApr), balance_subject_to_apr: l.lastStatementBalance }],
  })),
};

/* ----- recurring series (subscriptions + bills) ----- */
const SUBSCRIPTIONS = [
  { merchantName: "Netflix", category: C.subs, amount: 15.49, previousAmount: 13.99, priceChanged: true, day: 3, account: CHASE, brandColor: "#E50914" },
  { merchantName: "Spotify", category: C.subs, amount: 11.99, previousAmount: null, priceChanged: false, day: 5, account: CHASE, brandColor: "#1DB954" },
  { merchantName: "Disney+", category: C.subs, amount: 13.99, previousAmount: null, priceChanged: false, day: 14, account: CHASE, brandColor: "#113CCF" },
  { merchantName: "Adobe Creative Cloud", category: C.subs, amount: 54.99, previousAmount: null, priceChanged: false, day: 18, account: AMEX, brandColor: "#FF0000" },
  { merchantName: "Apple iCloud+", category: C.subs, amount: 2.99, previousAmount: null, priceChanged: false, day: 2, account: CASH, brandColor: "#555555" },
  { merchantName: "Equinox", category: C.health, amount: 24.99, previousAmount: null, priceChanged: false, day: 6, account: CHECKING, brandColor: "#000000" },
  { merchantName: "ChatGPT Plus", category: C.subs, amount: 20.0, previousAmount: null, priceChanged: false, day: 9, account: AMEX, brandColor: "#10A37F" },
  { merchantName: "Amazon Prime", category: C.subs, amount: 14.99, previousAmount: null, priceChanged: false, day: 22, account: CHASE, brandColor: "#FF9900" },
];
const BILLS = [
  { merchantName: "Greystar Apartments", category: C.housing, amount: 1850, day: 1, account: CHECKING, brandColor: "#334155" },
  { merchantName: "Verizon Fios", category: C.utilities, amount: 79.99, day: 10, account: CHECKING, brandColor: "#CD040B" },
  { merchantName: "T-Mobile", category: C.utilities, amount: 85, day: 12, account: CHECKING, brandColor: "#E20074" },
  { merchantName: "GEICO Insurance", category: C.finance, amount: 142, day: 20, account: CHECKING, brandColor: "#0a5ca8" },
];
const nextDate = (day: number): string => {
  const m6 = day >= TODAY.d ? 6 : 7;
  return dateStr(2026, m6, day);
};
const lastDate = (day: number): string => dateStr(2026, day >= TODAY.d ? 4 : 5, day);
const recurringRows = [
  ...SUBSCRIPTIONS.map((s) => ({ ...s, kind: "subscription" as const })),
  ...BILLS.map((b) => ({ ...b, previousAmount: null, priceChanged: false, kind: "bill" as const })),
].map((r) => ({
  merchantName: r.merchantName,
  category: r.category,
  kind: r.kind,
  amount: m(r.amount),
  cadence: "monthly",
  nextChargeDate: nextDate(r.day),
  lastChargeDate: lastDate(r.day),
  previousAmount: r.previousAmount === null ? null : m(r.previousAmount),
  priceChanged: r.priceChanged,
  status: "active",
  brandColor: r.brandColor,
}));

/* ----- lifestyle habits + money leaks ----- */
const lifestyleHabitsRows = [
  { category: C.dining, emoji: "\u2615", label: "Coffee runs", monthlyAmount: m(118) },
  { category: C.dining, emoji: "\uD83C\uDF54", label: "Dining out & delivery", monthlyAmount: m(540) },
  { category: C.transport, emoji: "\uD83D\uDE97", label: "Rideshare", monthlyAmount: m(165) },
  { category: C.subs, emoji: "\uD83D\uDCFA", label: "Subscriptions", monthlyAmount: m(158) },
];
function feeTotal(sub: string): { count: number; total: number } {
  const rows = txns.filter((t) => !t.pending && t.subCategory === sub);
  return { count: rows.length, total: round2(rows.reduce((s, t) => s + t.amount, 0)) };
}
const atm = feeTotal("Bank Fees");
const leaksFees = [
  { id: "atm", label: "ATM & overdraft fees", source: "Everyday Checking", count: atm.count, total: m(atm.total), fixable: true },
  { id: "late", label: "Late payment fees", source: "Citi Double Cash", count: 2, total: m(78), fixable: true },
  { id: "fx", label: "Foreign transaction fees", source: "Chase Sapphire", count: 4, total: m(46.2), fixable: true },
  { id: "interest", label: "Interest charges", source: "Credit cards", count: 6, total: m(214.5), fixable: false },
];

/* ----- budgets + goals (planning) ----- */
const BUDGET_DEFS = [
  { category: C.dining, emoji: "\uD83C\uDF7D\uFE0F", color: "#F97316", limit: 650 },
  { category: C.groceries, emoji: "\uD83D\uDED2", color: "#3B82F6", limit: 600 },
  { category: C.transport, emoji: "\uD83D\uDE97", color: "#6B7280", limit: 300 },
  { category: C.shopping, emoji: "\uD83D\uDECD\uFE0F", color: "#22C55E", limit: 400 },
  { category: C.entertainment, emoji: "\uD83C\uDFAC", color: "#A855F7", limit: 150 },
  { category: C.subs, emoji: "\uD83D\uDCF1", color: "#EF4444", limit: 180 },
  { category: C.health, emoji: "\uD83D\uDC8A", color: "#EC4899", limit: 120 },
];
const budgetsRows = BUDGET_DEFS.map((b) => {
  const spent = latestCats.find((c) => c.name === b.category)?.amount ?? 0;
  return { category: b.category, emoji: b.emoji, color: b.color, limit: m(b.limit), spent: m(spent) };
});
const goalsRows = [
  { name: "Emergency Fund", emoji: "\uD83D\uDEE1\uFE0F", color: "#22C55E", target: 10000, current: 6420, deadline: "2026-12-31" },
  { name: "Japan Trip", emoji: "\u2708\uFE0F", color: "#14B8A6", target: 4500, current: 1800, deadline: "2026-08-31" },
  { name: "New Car Fund", emoji: "\uD83D\uDE99", color: "#6366F1", target: 12000, current: 4200, deadline: "2027-06-30" },
];
const safeToSpend = 47;
const daysRemaining = daysInMonth(2026, 5) - 4;

/* ----- investments response ----- */
const holdingRows = HOLDINGS.map((h) => {
  const price = priceOf(h.ticker);
  const value = round2(h.quantity * price);
  const cost = round2(h.quantity * h.costBasis);
  const sec = SECS.find((s) => s.ticker === h.ticker)!;
  return {
    ticker: h.ticker,
    name: sec.name,
    sector: sec.sector,
    assetType: sec.assetType,
    quantity: h.quantity,
    costBasis: m(h.costBasis),
    currentPrice: m(price),
    value: m(value),
    gainLoss: m(value - cost),
    gainLossPercent: round2(((value - cost) / cost) * 100),
  };
});
const portfolioValue = round2(holdingRows.reduce((s, h) => s + Number.parseFloat(h.value), 0));
const totalCostBasis = round2(HOLDINGS.reduce((s, h) => s + h.quantity * h.costBasis, 0));

/* ----- wellness ----- */
const wellnessHistory = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
const wellnessScoresSeries = [60, 63, 61, 65, 68, 67, 70, 72];
const wellnessDimensions = [
  { name: "Savings Rate", score: 74, weight: 20, description: "Saving 18% of income — above the 15% target.", trend: "up" },
  { name: "Debt Health", score: 68, weight: 18, description: "Utilization at 14%, one card past due.", trend: "down" },
  { name: "Emergency Fund", score: 64, weight: 18, description: "3.6 months of expenses banked.", trend: "up" },
  { name: "Income vs Expense", score: 78, weight: 15, description: "Spending 82% of take-home pay.", trend: "neutral" },
  { name: "Inflation Beat", score: 58, weight: 10, description: "Raise trailed personal inflation by 0.8%.", trend: "down" },
  { name: "Investment Growth", score: 81, weight: 12, description: "Portfolio up 11% on cost basis.", trend: "up" },
  { name: "Goal Pace", score: 70, weight: 7, description: "On pace for 2 of 3 goals.", trend: "up" },
];

/* ----- DNA ----- */
const dnaResponse = {
  archetype: "The Experience Seeker",
  narrative: "You prioritize dining, travel, and experiences over things — and you save more than most peers in your bracket.",
  peerRarity: "6% of peers",
  axes: [
    { label: "Dining", you: 82, peers: 48 },
    { label: "Travel", you: 71, peers: 39 },
    { label: "Shopping", you: 44, peers: 58 },
    { label: "Groceries", you: 52, peers: 61 },
    { label: "Subscriptions", you: 66, peers: 41 },
    { label: "Transport", you: 49, peers: 55 },
    { label: "Wellness", you: 63, peers: 44 },
    { label: "Savings", you: 70, peers: 50 },
  ],
};

/* ----- patterns (day of week + detected) ----- */
const dowTotals = [0, 0, 0, 0, 0, 0, 0];
const dowCounts = [0, 0, 0, 0, 0, 0, 0];
for (const t of txns) {
  if (t.pending || !isSpend(t)) continue;
  const [yy, mm, dd] = t.date.split("-").map(Number);
  const dow = dowOf(yy!, mm!, dd!);
  dowTotals[dow]! += t.amount;
  dowCounts[dow]! += 1;
}
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const patternsResponse = {
  dayOfWeek: DOW_LABELS.map((day, i) => ({ day, value: m(dowCounts[i]! > 0 ? dowTotals[i]! / dowCounts[i]! : 0) })),
  patterns: [
    { label: "Weekend spending", value: "+43%", description: "You spend 43% more on Saturdays and Sundays vs weekdays.", severity: "warning" },
    { label: "Post-payday splurge", value: "+67%", description: "In the 3 days after each paycheck, spending spikes.", severity: "warning" },
    { label: "Late-night orders", value: "$189/mo", description: "38% of delivery orders happen between 10pm-2am.", severity: "neutral" },
    { label: "Stress spending", value: "+28%", description: "Dining and shopping rise on high-workload weeks.", severity: "neutral" },
  ],
};

/* ----- behavioral ----- */
const recentTagged = txns.filter((t) => !t.pending && isSpend(t)).slice(0, 6);
const REASONS = [
  { id: "need", emoji: "\u2705", label: "Need", color: "#22C55E" },
  { id: "treat", emoji: "\uD83C\uDF70", label: "Treat", color: "#F97316" },
  { id: "social", emoji: "\uD83E\uDD42", label: "Social", color: "#3B82F6" },
  { id: "bored", emoji: "\uD83D\uDE2A", label: "Bored", color: "#A855F7" },
  { id: "stress", emoji: "\uD83D\uDE2B", label: "Stress", color: "#EF4444" },
  { id: "impulse", emoji: "\u26A1", label: "Impulse", color: "#EAB308" },
];
const behavioralResponse = {
  archetype: "The Foodie",
  archetypeStat: "$14,200/yr on dining — 11% above median",
  creep: {
    months: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"],
    income: [7200, 7200, 7600, 7200, 7200, 7400, 7400, 7400, 7400, 7600].map(String),
    spending: [4800, 4900, 5200, 5100, 5500, 5200, 5300, 5600, 5400, 5500].map(String),
  },
  reasons: REASONS.map((r) => ({ ...r, total: m([1840, 420, 610, 290, 540, 480][REASONS.indexOf(r)]!) })),
  taggedTransactions: recentTagged.map((t, i) => ({
    id: t.id,
    merchant: t.merchantName ?? t.name,
    amount: m(t.amount),
    date: t.date,
    emoji: "\uD83D\uDCB3",
    reasonId: REASONS[i % REASONS.length]!.id,
  })),
  challenges: [
    { title: "Dining budget cut", goal: "Reduce dining by 20% this month", progressPercent: 62, daysRemaining: 18, complete: false, color: "#F97316" },
    { title: "No impulse over $50", goal: "Wait 24h before any purchase >$50", progressPercent: 85, daysRemaining: 6, complete: false, color: "#22C55E" },
    { title: "Cook 5 nights/week", goal: "Five home-cooked dinners weekly", progressPercent: 100, daysRemaining: 0, complete: true, color: "#3B82F6" },
  ],
  streaks: [
    { label: "Under dining budget", currentDays: 12, maxDays: 21, color: "#F97316" },
    { label: "No overdrafts", currentDays: 34, maxDays: 60, color: "#22C55E" },
    { label: "Daily check-in", currentDays: 8, maxDays: 14, color: "#3B82F6" },
  ],
};

/* ----- inflation ----- */
const inflationCategoriesRows = [
  { name: "Housing & Home", share: 32, inflationRate: 3.0, severity: "medium" },
  { name: "Food & Groceries", share: 14, inflationRate: 3.8, severity: "high" },
  { name: "Dining & Restaurants", share: 12, inflationRate: 4.2, severity: "high" },
  { name: "Transportation", share: 9, inflationRate: 2.4, severity: "low" },
  { name: "Health & Medical", share: 8, inflationRate: 4.1, severity: "high" },
  { name: "Utilities & Bills", share: 8, inflationRate: 3.3, severity: "medium" },
  { name: "Subscriptions & Software", share: 6, inflationRate: 5.0, severity: "high" },
  { name: "Shopping & Retail", share: 7, inflationRate: 1.9, severity: "low" },
  { name: "Travel", share: 4, inflationRate: 2.7, severity: "low" },
];
const personalRate = round2(inflationCategoriesRows.reduce((s, c) => s + (c.share / 100) * c.inflationRate, 0));
const inflationProfile = {
  personalRate,
  nationalCpi: 3.1,
  salary: 80640,
  raisePercent: 3.0,
  nominalSavingsRate: 18.0,
  powerLoss: 1240,
  baseDate: "2024-01-01",
};

/* ----- resilience ----- */
const liquidCash = round2(cashAssets);
const monthlyBurn = round2(avgMonthlySpend);
const resilienceScenarios = [
  { name: "Job loss", emoji: "\uD83D\uDCBC", shockAmount: monthlyBurn, shockType: "recurring", recommendedMonths: 6, detail: "No income; covered by liquid savings." },
  { name: "Major car repair", emoji: "\uD83D\uDD27", shockAmount: 3200, shockType: "one_time", recommendedMonths: 1, detail: "Transmission or engine repair." },
  { name: "Medical emergency", emoji: "\uD83C\uDFE5", shockAmount: 5000, shockType: "one_time", recommendedMonths: 2, detail: "Out-of-pocket max after insurance." },
  { name: "Rate hike on debt", emoji: "\uD83D\uDCC8", shockAmount: 180, shockType: "recurring", recommendedMonths: 3, detail: "Variable APR rises on balances." },
  { name: "Rent increase", emoji: "\uD83C\uDFE0", shockAmount: 250, shockType: "recurring", recommendedMonths: 3, detail: "Lease renewal bump." },
];

/* ----- fire ----- */
const fireProfile = {
  currentAge: 29,
  currentNetWorth: m(netWorth),
  monthlySpend: m(4200),
  monthlyInvest: m(2100),
  withdrawalRate: 4.0,
  realReturn: 6.0,
};

/* ----- coach ----- */
const coachInsightsRows = [
  { kind: "narrative", periodMonth: latestMonth, question: null, answer: "May was your best month financially in 2026. You spent $3,847 (down 6% from April), saved 19% of your income, and your net worth crossed $85K. Watch dining — it's creeping up again." },
  { kind: "qa", periodMonth: null, question: "How much did I spend on food delivery last month?", answer: "Last month you spent **$312** on food delivery across DoorDash and Uber Eats — about 38% more than your 6-month average." },
  { kind: "qa", periodMonth: null, question: "Am I on track to hit my emergency fund goal?", answer: "Your emergency fund goal is $10,000 by December 2026. You're at **$6,420 (64.2%)** and saving ~$600/mo, so you're on pace." },
  { kind: "qa", periodMonth: null, question: "What's my biggest wasted expense?", answer: "Your **Adobe Creative Cloud** subscription at $54.99/month is your largest rarely-used recurring charge — $660/year." },
  { kind: "forecast", periodMonth: "2026-06", question: null, answer: "Expect to spend $3,600-$3,950 in June. Adobe annual renewal ($660) hits mid-month and your Japan fund auto-transfer is $200. Projected savings rate: 18-21%." },
];

/* ----- wrapped (2025) ----- */
const txns2025 = txns.filter((t) => !t.pending && t.date.startsWith("2025-"));
const spent2025 = round2(txns2025.filter(isSpend).reduce((s, t) => s + t.amount, 0));
const income2025 = round2(txns2025.filter(isIncome).reduce((s, t) => s + Math.abs(t.amount), 0));
const wrappedSummary = {
  year: 2025,
  totalSpent: m(spent2025),
  transactionCount: txns2025.length,
  totalSaved: m(income2025 - spent2025),
  savingsRate: round2(income2025 > 0 ? ((income2025 - spent2025) / income2025) * 100 : 0),
  peerPercentile: "Top 14%",
  archetype: "The Experience Seeker",
  topCategory: { name: "Dining & Restaurants", amount: m(round2(txns2025.filter((t) => isSpend(t) && t.category === C.dining).reduce((s, t) => s + t.amount, 0))) },
  personality: { restaurantVisits: 412, deliveryOrders: 78, coffeeRuns: 196, travelTrips: 3 },
  moments: [
    { label: "Biggest purchase", value: "$1,299 at Best Buy" },
    { label: "Best savings month", value: "October" },
    { label: "Most frugal day", value: "47 no-spend days" },
    { label: "Forgotten subscription", value: "Disney+ unused 4 months" },
  ],
};
const wrappedGoals = goalsRows.map((g) => ({ label: g.name, target: m(g.target), pct: round2((g.current / g.target) * 100) }));

/* ----- merchants ----- */
const merchantAgg = new Map<string, { total: number; visits: number; months: Map<string, number> }>();
for (const t of txns) {
  if (t.pending || !isSpend(t) || !t.merchantName) continue;
  const e = merchantAgg.get(t.merchantName) ?? { total: 0, visits: 0, months: new Map() };
  e.total += t.amount;
  e.visits += 1;
  const mk = t.date.slice(0, 7);
  e.months.set(mk, (e.months.get(mk) ?? 0) + t.amount);
  merchantAgg.set(t.merchantName, e);
}
const last6 = spendMonths.slice(-6);
const MERCHANT_EMOJI: Record<string, string> = { Amazon: "\uD83D\uDCE6", "Whole Foods Market": "\uD83E\uDD51", DoorDash: "\uD83C\uDF7D\uFE0F", Shell: "\u26FD", Starbucks: "\u2615", Uber: "\uD83D\uDE97" };
const merchantsTop = [...merchantAgg.entries()]
  .sort((a, b) => b[1].total - a[1].total)
  .slice(0, 6)
  .map(([name, e]) => {
    const trail = last6.map((mk) => round2(e.months.get(mk) ?? 0));
    const prev = trail[trail.length - 2] || 1;
    const curr = trail[trail.length - 1] || 0;
    return { name, emoji: MERCHANT_EMOJI[name] ?? "\uD83C\uDFEC", visits: e.visits, total: m(e.total), trend: round2(((curr - prev) / prev) * 100), trail };
  });
const merchantsResponse = {
  merchants: merchantsTop,
  income: {
    months: last6.map((mk) => mk.slice(5)),
    primary: last6.map((mk) => Math.round(monthAgg.get(mk)!.income)),
    side: last6.map((mk) => Math.round(txns.filter((t) => !t.pending && t.subCategory === "Side Income" && t.date.slice(0, 7) === mk).reduce((s, t) => s + Math.abs(t.amount), 0))),
  },
  merchantCount: merchantAgg.size,
  incomeSources: 2,
};

/* ----- calendar + forecast (current month derived) ----- */
const calendarEvents = [
  ...BILLS.map((b) => ({ day: b.day, type: "bill", label: b.merchantName, amount: m(b.amount) })),
  ...SUBSCRIPTIONS.filter((s) => s.amount >= 10).map((s) => ({ day: s.day, type: "subscription", label: s.merchantName, amount: m(s.amount) })),
  { day: 1, type: "income", label: "Paycheck", amount: m(SALARY_AFTER) },
  { day: 15, type: "income", label: "Paycheck", amount: m(SALARY_AFTER) },
  { day: 2, type: "goal", label: "Japan fund transfer", amount: "200.00" },
];
const calendarResponse = {
  month: "2026-06",
  events: calendarEvents,
  heat: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, level: randInt(0, 3) })),
  totals: {
    income: m(SALARY_AFTER * 2),
    bills: m(BILLS.reduce((s, b) => s + b.amount, 0) + SUBSCRIPTIONS.reduce((s, sub) => s + sub.amount, 0)),
  },
  safeToSpendToday: "74.00",
};
const WEATHERS = ["sunny", "partly", "cloudy", "stormy"] as const;
const forecastResponse = {
  days: Array.from({ length: 7 }, (_, i) => {
    const d = TODAY.d + i;
    const balance = round2(4218 - i * 180 + (i === 4 ? -650 : 0));
    return {
      date: `Jun ${d}`,
      weekday: DOW_LABELS[dowOf(2026, 6, d)]!,
      weather: balance < 2500 ? "stormy" : balance < 3200 ? "cloudy" : balance < 3800 ? "partly" : "sunny",
      projectedBalance: m(balance),
      note: i === 4 ? "Rent + bills cluster" : i === 6 ? "Just before payday" : "",
    };
  }),
  comfortFloor: "2500.00",
  minBalance: m(round2(4218 - 6 * 180 - 650)),
  lowestDay: "Jun 9",
  nextClearDate: "Jun 15",
  recommendation: "Move ~$150 of discretionary spending past Jun 15 to stay above your $2,500 comfort floor.",
};
void WEATHERS;

/* ----------------------------- write mock/ (DB seed) ----------------------------- */

const plaidGroups = new Map<string, { institutionName: string; institutionId: string; accountIds: string[] }>();
ACCOUNTS.forEach((a) => {
  if (a.source !== "plaid" || !a.itemKey) return;
  const g = plaidGroups.get(a.itemKey) ?? { institutionName: a.institutionName, institutionId: `ins_${a.itemKey}`, accountIds: [] };
  g.accountIds.push(a.id);
  plaidGroups.set(a.itemKey, g);
});
const plaidItemsFile = {
  items: [...plaidGroups.entries()].map(([key, g], i) => ({
    id: itemId(i + 1),
    plaidItemId: `mock-plaid-item-${key}`,
    accessToken: `access-sandbox-mock-${key}`,
    institutionId: g.institutionId,
    institutionName: g.institutionName,
    accountIds: g.accountIds,
  })),
};

const accountsSeedFile = {
  accounts: ACCOUNTS.map((a) => ({
    id: a.id,
    name: a.name,
    officialName: a.officialName,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    balanceCurrent: m(a.balanceCurrent),
    balanceAvailable: a.balanceAvailable === null ? null : m(a.balanceAvailable),
    currencyCode: "USD",
    institutionName: a.institutionName,
    source: a.source,
    plaidAccountId: a.source === "plaid" ? `mock-plaid-acct-${a.mask}` : null,
    lastSyncedAt: a.source === "plaid" ? "2026-06-02T08:15:00.000Z" : null,
    status: a.status,
  })),
};

const transactionsSeedFile = {
  items: txns.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    date: t.date,
    name: t.name,
    merchantName: t.merchantName,
    amount: m(t.amount),
    category: t.category,
    subCategory: t.subCategory,
    transactionType: t.transactionType,
    isTransfer: t.isTransfer,
    pending: t.pending,
  })),
};

const securitiesFile = {
  securities: SECS.map((s, i) => ({
    id: secId(i + 1),
    ticker: s.ticker,
    name: s.name,
    assetType: s.assetType,
    sector: s.sector,
    currentPrice: s.price.toFixed(4),
    currencyCode: "USD",
  })),
};
const holdingsFile = {
  holdings: HOLDINGS.map((h) => ({
    accountId: h.accountId,
    securityId: secIdByTicker.get(h.ticker)!,
    ticker: h.ticker,
    quantity: h.quantity.toString(),
    costBasis: h.costBasis.toFixed(4),
    institutionValue: m(h.quantity * priceOf(h.ticker)),
  })),
};
const investmentTxnsFile = {
  items: invTxns.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    securityId: t.ticker ? secIdByTicker.get(t.ticker)! : null,
    externalId: `inv:${t.id}`,
    date: t.date,
    name: t.name,
    type: t.type,
    quantity: t.quantity === null ? null : t.quantity.toString(),
    price: t.price === null ? null : t.price.toFixed(4),
    amount: m(t.amount),
    fees: m(t.fees),
  })),
};

const merchantRulesFile = {
  rules: [
    { merchantKey: "whole foods market", category: C.groceries, subCategory: "Grocery Stores" },
    { merchantKey: "uber eats", category: C.dining, subCategory: "Food Delivery" },
    { merchantKey: "netflix", category: C.subs, subCategory: "Streaming" },
    { merchantKey: "shell", category: C.transport, subCategory: "Gas" },
    { merchantKey: "starbucks", category: C.dining, subCategory: "Coffee Shops" },
  ],
};

const householdFile = {
  household: { id: "00000000-0000-4000-8000-000000000010", name: "The Riveras" },
  members: [
    { id: "00000000-0000-4000-8000-000000000011", userEmail: DEV_USER.email, displayName: "Alex", role: "owner", avatarColor: "#7c3aed" },
    { id: "00000000-0000-4000-8000-000000000012", userEmail: PARTNER_USER.email, displayName: "Sam", role: "partner", avatarColor: "#ec4899" },
    { id: "00000000-0000-4000-8000-000000000013", userEmail: null, displayName: "Riley", role: "child", avatarColor: "#14b8a6" },
  ],
  accountAssignments: [
    { accountId: CHECKING, memberId: "00000000-0000-4000-8000-000000000011" },
    { accountId: SAVINGS, memberId: "00000000-0000-4000-8000-000000000011" },
    { accountId: CHASE, memberId: "00000000-0000-4000-8000-000000000011" },
    { accountId: AMEX, memberId: "00000000-0000-4000-8000-000000000012" },
    { accountId: CASH, memberId: "00000000-0000-4000-8000-000000000012" },
  ],
  invitations: [
    { memberId: "00000000-0000-4000-8000-000000000013", email: "riley@example.com", token: "seed-invite-riley-demo-token", expiresInDays: 7 },
  ],
};

const usersFile = { users: [DEV_USER, PARTNER_USER] };

const manifest = {
  version: 2,
  description: "Deterministic SpendFlow demo dataset (generated by scripts/generate-mock-dataset.ts)",
  devUserEmail: DEV_USER.email,
  partnerUserEmail: PARTNER_USER.email,
  externalIdPrefix: "mock:",
  generatedAt: dateStr(TODAY.y, TODAY.mo, TODAY.d),
  scenarios: [
    "all-account-types-checking-savings-cash-credit-brokerage-roth-401k-crypto-hsa",
    "fourteen-months-transactions-mom-yoy",
    "edge-cases-pending-transfers-refunds-duplicates-fees-large-purchases",
    "investments-holdings-securities-buys-sells-dividends-contributions",
    "planning-budgets-goals-recurring-networth",
    "insights-wellness-dna-patterns-behavioral",
    "protect-inflation-resilience",
    "coach-and-wrapped",
  ],
  files: {
    users: "users.json",
    accounts: "accounts.json",
    plaidItems: "plaid-items.json",
    transactions: "transactions.json",
    creditCardLiabilities: "credit-card-liabilities.json",
    merchantCategoryRules: "merchant-category-rules.json",
    household: "household.json",
    securities: "securities.json",
    holdings: "holdings.json",
    investmentTransactions: "investment-transactions.json",
    netWorthSnapshots: "net-worth-snapshots.json",
    budgets: "budgets.json",
    savingsGoals: "savings-goals.json",
    recurringSeries: "recurring-series.json",
    fireProfile: "fire-profile.json",
    wellnessScores: "wellness-scores.json",
    spendingDna: "spending-dna.json",
    spendingPatterns: "spending-patterns.json",
    transactionReasons: "transaction-reasons.json",
    challenges: "challenges.json",
    habitStreaks: "habit-streaks.json",
    lifestyleHabits: "lifestyle-habits.json",
    inflationProfile: "inflation-profile.json",
    inflationCategories: "inflation-categories.json",
    resilienceProfile: "resilience-profile.json",
    resilienceScenarios: "resilience-scenarios.json",
    coachInsights: "coach-insights.json",
    wrappedSummaries: "wrapped-summaries.json",
  },
};

// raw rows for new feature tables (DB shapes)
const netWorthFile = { snapshots: netWorthSnapshots };
const budgetsSeedFile = { periodMonth: latestMonth, budgets: BUDGET_DEFS.map((b) => ({ category: b.category, periodMonth: latestMonth, limitAmount: m(b.limit), emoji: b.emoji, color: b.color })) };
const goalsSeedFile = { goals: goalsRows.map((g) => ({ name: g.name, targetAmount: m(g.target), currentAmount: m(g.current), deadline: g.deadline, emoji: g.emoji, color: g.color })) };
const recurringSeedFile = { series: recurringRows };
const fireSeedFile = fireProfile;
const wellnessSeedFile = {
  scores: wellnessHistory.map((mk, i) => ({ periodMonth: mk, score: wellnessScoresSeries[i]!, dimensions: mk === "2026-05" ? wellnessDimensions : [] })),
};
const dnaSeedFile = { archetype: dnaResponse.archetype, narrative: dnaResponse.narrative, peerRarity: dnaResponse.peerRarity, axes: dnaResponse.axes };
const patternsSeedFile = {
  patterns: [
    ...patternsResponse.dayOfWeek.map((d, i) => ({ kind: "day_of_week", label: d.day, metric: d.value, description: null, severity: null, sortOrder: i })),
    ...patternsResponse.patterns.map((p, i) => ({ kind: "pattern", label: p.label, metric: p.value, description: p.description, severity: p.severity, sortOrder: i })),
  ],
};
const reasonsSeedFile = { reasons: behavioralResponse.taggedTransactions.map((t) => ({ transactionId: t.id, reasonId: t.reasonId })) };
const challengesSeedFile = { challenges: behavioralResponse.challenges };
const streaksSeedFile = { streaks: behavioralResponse.streaks.map((s) => ({ label: s.label, currentDays: s.currentDays, maxDays: s.maxDays, color: s.color })) };
const habitsSeedFile = { habits: lifestyleHabitsRows };
const inflationProfileSeed = inflationProfile;
const inflationCategoriesSeed = { categories: inflationCategoriesRows.map((c, i) => ({ ...c, sortOrder: i })) };
const resilienceProfileSeed = { liquidCash: m(liquidCash), monthlyBurn: m(monthlyBurn) };
const resilienceScenariosSeed = { scenarios: resilienceScenarios.map((s, i) => ({ name: s.name, emoji: s.emoji, shockAmount: m(s.shockAmount), shockType: s.shockType, recommendedMonths: s.recommendedMonths, detail: s.detail, sortOrder: i })) };
const coachSeedFile = { insights: coachInsightsRows.map((c, i) => ({ ...c, sortOrder: i })) };
const wrappedSeedFile = { summaries: [{ ...wrappedSummary }] };

const mockFiles: Array<[string, unknown]> = [
  ["manifest.json", manifest],
  ["users.json", usersFile],
  ["accounts.json", accountsSeedFile],
  ["plaid-items.json", plaidItemsFile],
  ["transactions.json", transactionsSeedFile],
  ["credit-card-liabilities.json", creditLiabilitiesFile],
  ["merchant-category-rules.json", merchantRulesFile],
  ["household.json", householdFile],
  ["securities.json", securitiesFile],
  ["holdings.json", holdingsFile],
  ["investment-transactions.json", investmentTxnsFile],
  ["net-worth-snapshots.json", netWorthFile],
  ["budgets.json", budgetsSeedFile],
  ["savings-goals.json", goalsSeedFile],
  ["recurring-series.json", recurringSeedFile],
  ["fire-profile.json", fireSeedFile],
  ["wellness-scores.json", wellnessSeedFile],
  ["spending-dna.json", dnaSeedFile],
  ["spending-patterns.json", patternsSeedFile],
  ["transaction-reasons.json", reasonsSeedFile],
  ["challenges.json", challengesSeedFile],
  ["habit-streaks.json", streaksSeedFile],
  ["lifestyle-habits.json", habitsSeedFile],
  ["inflation-profile.json", inflationProfileSeed],
  ["inflation-categories.json", inflationCategoriesSeed],
  ["resilience-profile.json", resilienceProfileSeed],
  ["resilience-scenarios.json", resilienceScenariosSeed],
  ["coach-insights.json", coachSeedFile],
  ["wrapped-summaries.json", wrappedSeedFile],
];
for (const [file, data] of mockFiles) writeJson(MOCK_ROOT, file, data);

/* ----------------------------- write ui/src/mocks (API shapes) ----------------------------- */

const liabilityByAccount = new Map(
  creditLiabilities.map((l) => {
    const stmt = Number.parseFloat(l.lastStatementBalance);
    const apr = Number.parseFloat(l.purchaseApr);
    const due = new Date(l.nextPaymentDueDate);
    const days = Math.round((due.getTime() - new Date("2026-06-03").getTime()) / 86400000);
    return [
      l.accountId,
      {
        lastStatementBalance: l.lastStatementBalance,
        lastStatementIssueDate: l.lastStatementIssueDate,
        minimumPaymentAmount: l.minimumPaymentAmount,
        nextPaymentDueDate: l.nextPaymentDueDate,
        lastPaymentAmount: l.lastPaymentAmount,
        lastPaymentDate: l.lastPaymentDate,
        isOverdue: l.isOverdue,
        aprs: [{ aprType: "purchase", aprPercentage: l.purchaseApr, balanceSubjectToApr: l.lastStatementBalance, interestChargeAmount: m((stmt * apr) / 1200) }],
        purchaseApr: l.purchaseApr,
        estimatedMonthlyInterest: m((stmt * apr) / 1200),
        statementVsCurrentDelta: m(ACCOUNTS.find((a) => a.id === l.accountId)!.balanceCurrent - stmt),
        daysUntilDue: days,
        syncedAt: "2026-06-02T08:15:00.000Z",
      },
    ];
  }),
);

const uiAccounts = ACCOUNTS.map((a) => ({
  id: a.id,
  name: a.name,
  officialName: a.officialName,
  type: a.type,
  subtype: a.subtype,
  mask: a.mask,
  balanceCurrent: m(a.balanceCurrent),
  balanceAvailable: a.balanceAvailable === null ? null : m(a.balanceAvailable),
  currencyCode: "USD",
  institutionName: a.institutionName,
  lastSyncedAt: a.source === "plaid" ? "2026-06-02T08:15:00.000Z" : null,
  status: a.status,
  source: a.source,
  liability: liabilityByAccount.get(a.id) ?? null,
}));

const maskById = new Map(ACCOUNTS.map((a) => [a.id, a.mask]));
const uiTransactions = {
  items: txns.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    accountMask: maskById.get(t.accountId) ?? null,
    date: t.date,
    name: t.name,
    merchantName: t.merchantName,
    amount: m(t.amount),
    currencyCode: "USD",
    category: t.category,
    subCategory: t.subCategory,
    transactionType: t.transactionType,
    isTransfer: t.isTransfer,
    pending: t.pending,
  })),
  nextCursor: null,
};

const netWorthResponse = {
  current: { netWorth: m(netWorth), totalAssets: m(totalAssets), totalLiabilities: m(totalLiabilities) },
  trend: netWorthSnapshots.map((s) => ({ month: s.month, netWorth: s.netWorth })),
};

const investmentsResponse = {
  portfolioValue: m(portfolioValue),
  totalCostBasis: m(totalCostBasis),
  totalGainLoss: m(portfolioValue - totalCostBasis),
  totalGainLossPercent: round2(((portfolioValue - totalCostBasis) / totalCostBasis) * 100),
  accounts: ACCOUNTS.filter((a) => a.type === "investment").map((a) => ({ accountId: a.id, name: a.name, institutionName: a.institutionName, subtype: a.subtype, value: m(a.balanceCurrent) })),
  holdings: holdingRows,
  behavioralAlerts: [
    { type: "warning", title: "Concentration risk", desc: "AAPL is 35% of your taxable brokerage — consider diversifying." },
    { type: "info", title: "Dollar-cost averaging working", desc: "Your monthly buys lowered your average cost basis by 4%." },
    { type: "positive", title: "You invest more than you dine out", desc: "You invested $2,100 last month vs $487 on dining." },
  ],
};

const budgetsResponse = { periodMonth: latestMonth, safeToSpend: m(safeToSpend), daysRemaining, budgets: budgetsRows, goals: goalsRows.map((g) => ({ name: g.name, emoji: g.emoji, color: g.color, target: m(g.target), current: m(g.current), deadline: g.deadline })) };

const recurringResponse = {
  monthlyTotal: m(SUBSCRIPTIONS.reduce((s, x) => s + x.amount, 0)),
  annualTotal: m(SUBSCRIPTIONS.reduce((s, x) => s + x.amount, 0) * 12),
  activeCount: SUBSCRIPTIONS.length,
  priceChanges: SUBSCRIPTIONS.filter((s) => s.priceChanged).length,
  subscriptions: recurringRows.filter((r) => r.kind === "subscription"),
  bills: recurringRows.filter((r) => r.kind === "bill"),
  leaks: { fees: leaksFees, habits: lifestyleHabitsRows.map((h) => ({ id: h.label.toLowerCase().replace(/\s+/g, "-"), emoji: h.emoji, label: h.label, monthly: h.monthlyAmount })) },
};

const wellnessResponse = {
  score: wellnessScoresSeries[wellnessScoresSeries.length - 1]!,
  delta: wellnessScoresSeries[wellnessScoresSeries.length - 1]! - wellnessScoresSeries[wellnessScoresSeries.length - 2]!,
  history: wellnessHistory.map((mk, i) => ({ month: mk.slice(5), score: wellnessScoresSeries[i]! })),
  dimensions: wellnessDimensions,
};

const inflationResponse = {
  personalRate: inflationProfile.personalRate,
  nationalCpi: inflationProfile.nationalCpi,
  salaryRaise: inflationProfile.raisePercent,
  nominalSavingsRate: inflationProfile.nominalSavingsRate,
  realSavingsRate: round2(inflationProfile.nominalSavingsRate - inflationProfile.personalRate),
  realRaise: round2(inflationProfile.raisePercent - inflationProfile.personalRate),
  powerLoss: m(inflationProfile.powerLoss),
  salary: m(inflationProfile.salary),
  breakEvenSalary: m(inflationProfile.salary * (1 + inflationProfile.personalRate / 100)),
  targetSalary: m(inflationProfile.salary * (1 + (inflationProfile.personalRate + 5) / 100)),
  categories: inflationCategoriesRows.map((c) => ({ name: c.name, share: c.share, inflation: c.inflationRate, severity: c.severity })),
};

const runwayMonths = round2(liquidCash / monthlyBurn);
const resilienceResponse = {
  liquidCash: m(liquidCash),
  monthlyBurn: m(monthlyBurn),
  runwayMonths,
  immunityScore: 68,
  scenarios: resilienceScenarios.map((s, i) => {
    const monthsCovered = s.shockType === "recurring" ? round2(liquidCash / (monthlyBurn + s.shockAmount)) : round2(liquidCash / s.shockAmount);
    return { id: `scenario-${i}`, name: s.name, emoji: s.emoji, shockAmount: m(s.shockAmount), shockType: s.shockType, monthsCovered, recommendedMonths: s.recommendedMonths, detail: s.detail };
  }),
};

const coachResponse = {
  narrative: coachInsightsRows.find((c) => c.kind === "narrative")!.answer,
  forecast: coachInsightsRows.find((c) => c.kind === "forecast")!.answer,
  qa: coachInsightsRows.filter((c) => c.kind === "qa").map((c) => ({ q: c.question!, a: c.answer })),
};

const wrappedResponse = {
  year: wrappedSummary.year,
  totalSpent: wrappedSummary.totalSpent,
  transactionCount: wrappedSummary.transactionCount,
  totalSaved: wrappedSummary.totalSaved,
  savingsRate: wrappedSummary.savingsRate,
  peerPercentile: wrappedSummary.peerPercentile,
  archetype: wrappedSummary.archetype,
  topCategory: wrappedSummary.topCategory,
  personality: wrappedSummary.personality,
  moments: wrappedSummary.moments,
  goals: wrappedGoals,
};

const fireResponse = {
  currentAge: fireProfile.currentAge,
  currentNetWorth: fireProfile.currentNetWorth,
  monthlySpend: fireProfile.monthlySpend,
  monthlyInvest: fireProfile.monthlyInvest,
  withdrawalRate: fireProfile.withdrawalRate,
  realReturn: fireProfile.realReturn,
};

const uiMockFiles: Array<[string, unknown]> = [
  ["accounts.json", { accounts: uiAccounts }],
  ["transactions.json", uiTransactions],
  ["summary.json", summaryResponse],
  ["categories.json", categoriesResponse],
  ["trends.json", trendsResponse],
  ["money-flow.json", moneyFlowResponse],
  ["alerts.json", alertsResponse],
  ["net-worth.json", netWorthResponse],
  ["investments.json", investmentsResponse],
  ["budgets.json", budgetsResponse],
  ["recurring.json", recurringResponse],
  ["calendar.json", calendarResponse],
  ["forecast.json", forecastResponse],
  ["wellness.json", wellnessResponse],
  ["dna.json", dnaResponse],
  ["patterns.json", patternsResponse],
  ["behavioral.json", behavioralResponse],
  ["inflation.json", inflationResponse],
  ["resilience.json", resilienceResponse],
  ["fire.json", fireResponse],
  ["coach.json", coachResponse],
  ["wrapped.json", wrappedResponse],
  ["merchants.json", merchantsResponse],
];
for (const [file, data] of uiMockFiles) writeJson(UI_MOCK_ROOT, file, data);

/* ----------------------------- summary log ----------------------------- */
console.log("Generated SpendFlow demo dataset:");
console.log(`  Accounts:              ${ACCOUNTS.length}`);
console.log(`  Transactions:          ${txns.length} (Apr 2025 - Jun 2026)`);
console.log(`  Investment txns:       ${invTxns.length}`);
console.log(`  Securities / holdings: ${SECS.length} / ${HOLDINGS.length}`);
console.log(`  Net worth:             $${m(netWorth)}  (assets ${m(totalAssets)} - liab ${m(totalLiabilities)})`);
console.log(`  mock/ files:           ${mockFiles.length}`);
console.log(`  ui/src/mocks/ files:   ${uiMockFiles.length}`);
console.log("Run `npm run db:seed` to load into Postgres, or set NEXT_PUBLIC_USE_MOCKS=true for the UI.");
