import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { eq, sql } from "drizzle-orm";
import { loadEnv } from "../src/config/env.js";
import { closeDb, getDb } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { accounts, transactions, users } from "../src/db/schema.js";

loadEnv();

const STATEMENTS_ROOT = resolve(process.cwd(), "../Statements");
const DEV_USER_EMAIL = "personal@spendflow.local";

interface ParsedTxn {
  externalId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  category: string;
  source: "qfx" | "bofa_pdf";
}

const TRANSFER_PATTERNS = [
  /mobile payment.*thank you/i,
  /american express des:ach pmt/i,
  /online scheduled payment/i,
  /payment thank you/i,
  /autopay/i,
];

function categorize(name: string): string {
  const n = name.toUpperCase();
  if (/CISCO SYSTEMS.*PAYROLL|PAYROLL|DIRECT DEPOSIT/.test(n)) return "Income";
  if (/ZELLE|FID BKG|MONEYLINE/.test(n)) return "Transfers";
  if (/AMERICAN EXPRESS.*ACH|ONLINE SCHEDULEMENT PAYMENT|VEHICLE LOAN/.test(n))
    return "Transfers";
  if (/COSTCO|WHOLE FOODS|SPROUTS|INDIA METRO|ANNAPURNA|SWADESHI|11TH INDIA|GROCERY/.test(n))
    return "Food & Groceries";
  if (/TST |RESTAURANT|DOMINO|VELVET TACO|SAYFANI|DESI |GHAZAL|SIMPLY SOUTH|SREE SHANK/.test(n))
    return "Dining & Restaurants";
  if (/CURSOR|APPLE\.COM|NETFLIX|BESTBRAINS|SUBSCRIPTION/.test(n))
    return "Subscriptions & Software";
  if (/COSERV|ALLENWATER|AT&T \*PAYMENT|UTILITY|ELECTRIC/.test(n))
    return "Utilities & Bills";
  if (/FEDEX|NTTA|TOLL|GAS|RACETRAC/.test(n)) return "Transport & Gas";
  if (/TARGET|PESTIE/.test(n)) return "Shopping & Retail";
  if (/INTEREST CHARGE|LATE FEE|FEE/.test(n)) return "Financial";
  if (/SCHLPAY|EDUCATION/.test(n)) return "Education";
  if (/BASE POWER/.test(n)) return "Home & Rent";
  if (/PINSTACK|ENTERTAINMENT/.test(n)) return "Entertainment";
  return "Uncategorized";
}

function classifyType(
  name: string,
  accountType: "credit" | "depository",
  signedAmount: number,
): { transactionType: ParsedTxn["transactionType"]; isTransfer: boolean } {
  if (TRANSFER_PATTERNS.some((p) => p.test(name))) {
    return { transactionType: "transfer", isTransfer: true };
  }
  if (accountType === "credit") {
    if (signedAmount > 0 && /PAYMENT|CREDIT|THANK YOU/.test(name.toUpperCase())) {
      return { transactionType: "transfer", isTransfer: true };
    }
    return { transactionType: "expense", isTransfer: false };
  }
  if (signedAmount < 0) return { transactionType: "income", isTransfer: false };
  return { transactionType: "expense", isTransfer: false };
}

function parseOfxDate(raw: string): string {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) throw new Error(`Invalid OFX date: ${raw}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseQfxFile(path: string): ParsedTxn[] {
  const content = readFileSync(path, "utf-8");
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) ?? [];
  const results: ParsedTxn[] = [];

  for (const block of blocks) {
    const tag = (name: string) => {
      const m = block.match(new RegExp(`<${name}>([^<\\n]+)`));
      return m?.[1]?.trim() ?? "";
    };

    const fitId = tag("FITID");
    const trnType = tag("TRNTYPE");
    const rawAmt = Number.parseFloat(tag("TRNAMT"));
    const name = tag("NAME") || tag("MEMO") || "Unknown";
    const date = parseOfxDate(tag("DTPOSTED"));

    let amount: string;
    if (trnType === "CREDIT" || rawAmt > 0) {
      amount = (-Math.abs(rawAmt)).toFixed(2);
    } else {
      amount = Math.abs(rawAmt).toFixed(2);
    }

    const { transactionType, isTransfer } = classifyType(name, "credit", rawAmt);
    if (isTransfer) {
      amount = Math.abs(Number.parseFloat(amount)).toFixed(2);
    }

    results.push({
      externalId: fitId || `${date}-${name}-${rawAmt}`,
      date,
      name,
      merchantName: name,
      amount,
      transactionType,
      isTransfer,
      category: isTransfer ? "Transfers (internal)" : categorize(name),
      source: "qfx",
    });
  }

  return results;
}

function inferYearFromFilename(path: string, fallbackYear: number): number {
  const match = path.match(/\/(20\d{2})\//);
  return match ? Number.parseInt(match[1]!, 10) : fallbackYear;
}

function parseBofaCcPdf(path: string): ParsedTxn[] {
  const text = execSync(`pdftotext -layout "${path}" -`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (/American Express/i.test(text) && !/Bank of America/i.test(text.slice(0, 2000))) {
    console.warn(`  (skip: Amex PDF in BOFA folder — use QFX instead)`);
    return [];
  }

  const periodMatch = text.match(
    /! Account # [\d ]+ ! ([A-Za-z]+ \d+,? \d{4}) - ([A-Za-z]+ \d+,? \d{4})/,
  );
  const endYear = periodMatch
    ? Number.parseInt(periodMatch[2]!.split(/[\s,]+/).pop()!, 10)
    : inferYearFromFilename(path, new Date().getFullYear());

  const lineRe =
    /^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+?)\s+(?:\d{4}\s+)?7138\s+(-?[\d,]+\.\d{2})\s*$/;
  const results: ParsedTxn[] = [];

  for (const line of text.split("\n")) {
    const m = line.match(lineRe);
    if (!m) continue;

    const posting = m[2]!;
    const [mm, dd] = posting.split("/");
    const year = endYear;
    const date = `${year}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
    const name = m[3]!.replace(/\s+/g, " ").trim();
    if (/^TOTAL /i.test(name)) continue;

    const raw = Number.parseFloat(m[4]!.replace(/,/g, ""));
    const isPayment = raw < 0;
    const { transactionType, isTransfer } = isPayment
      ? { transactionType: "transfer" as const, isTransfer: true }
      : classifyType(name, "credit", raw);

    const amount = Math.abs(raw).toFixed(2);

    results.push({
      externalId: `bofa-cc-${date}-${name}-${raw}`,
      date,
      name,
      merchantName: name,
      amount,
      transactionType,
      isTransfer: isTransfer || isPayment,
      category:
        isPayment || isTransfer ? "Transfers (internal)" : categorize(name),
      source: "bofa_pdf",
    });
  }

  return results;
}

function parseBofaSavingsPdf(path: string): ParsedTxn[] {
  const text = execSync(`pdftotext -layout "${path}" -`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const lineRe = /^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/;
  const results: ParsedTxn[] = [];

  for (const line of text.split("\n")) {
    const m = line.match(lineRe);
    if (!m) continue;
    if (m[2]!.includes("Total ")) continue;

    const [mm, dd, yy] = m[1]!.split("/");
    const date = `20${yy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
    const name = m[2]!.replace(/\s+/g, " ").trim();
    const raw = Number.parseFloat(m[3]!.replace(/,/g, ""));

    let amount: string;
    if (raw < 0) {
      amount = Math.abs(raw).toFixed(2);
    } else {
      amount = (-raw).toFixed(2);
    }

    const { transactionType, isTransfer } = classifyType(
      name,
      "depository",
      raw,
    );

    if (isTransfer) {
      amount = Math.abs(raw).toFixed(2);
    } else if (transactionType === "income") {
      amount = (-Math.abs(raw)).toFixed(2);
    } else {
      amount = Math.abs(raw).toFixed(2);
    }

    results.push({
      externalId: `bofa-sav-${date}-${name}-${raw}`,
      date,
      name,
      merchantName: name,
      amount,
      transactionType,
      isTransfer,
      category:
        transactionType === "income"
          ? "Income"
          : isTransfer
            ? "Transfers (internal)"
            : categorize(name),
      source: "bofa_pdf",
    });
  }

  return results;
}

function walkFiles(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkFiles(full, ext));
    } else if (full.toLowerCase().endsWith(ext)) {
      out.push(full);
    }
  }
  return out.sort();
}

async function migrate(): Promise<void> {
  await runMigrations();
}

async function main(): Promise<void> {
  console.log("Running migrations...");
  await migrate();

  const db = getDb();

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEV_USER_EMAIL))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email: DEV_USER_EMAIL })
      .returning();
  }

  const accountDefs = [
    {
      key: "amex",
      name: "American Express",
      officialName: "Amex Credit Card",
      type: "credit" as const,
      subtype: "credit card",
      mask: "24001",
      institutionName: "American Express",
    },
    {
      key: "bofa-cc-7138",
      name: "Bank of America Visa",
      officialName: "BOFA Credit Card",
      type: "credit" as const,
      subtype: "credit card",
      mask: "7138",
      institutionName: "Bank of America",
    },
    {
      key: "bofa-sav-4857",
      name: "Bank of America Savings",
      officialName: "Adv Plus Banking Savings",
      type: "depository" as const,
      subtype: "savings",
      mask: "4857",
      institutionName: "Bank of America",
    },
  ];

  const accountIds = new Map<string, string>();

  for (const def of accountDefs) {
    const existing = await db
      .select()
      .from(accounts)
      .where(eq(accounts.mask, def.mask))
      .limit(1);

    if (existing[0]) {
      accountIds.set(def.key, existing[0].id);
      continue;
    }

    const [row] = await db
      .insert(accounts)
      .values({
        userId: user!.id,
        name: def.name,
        officialName: def.officialName,
        type: def.type,
        subtype: def.subtype,
        mask: def.mask,
        institutionName: def.institutionName,
      })
      .returning();
    accountIds.set(def.key, row!.id);
  }

  const batches: { accountKey: string; txns: ParsedTxn[]; label: string }[] =
    [];

  for (const file of walkFiles(join(STATEMENTS_ROOT, "amex"), ".qfx")) {
    batches.push({
      accountKey: "amex",
      txns: parseQfxFile(file),
      label: basename(file),
    });
  }

  for (const file of walkFiles(
    join(STATEMENTS_ROOT, "BOFA/Account-7138"),
    ".pdf",
  )) {
    batches.push({
      accountKey: "bofa-cc-7138",
      txns: parseBofaCcPdf(file),
      label: basename(file),
    });
  }

  for (const file of walkFiles(
    join(STATEMENTS_ROOT, "BOFA/Saving-4857"),
    ".pdf",
  )) {
    batches.push({
      accountKey: "bofa-sav-4857",
      txns: parseBofaSavingsPdf(file),
      label: basename(file),
    });
  }

  let inserted = 0;
  let skipped = 0;

  for (const batch of batches) {
    const accountId = accountIds.get(batch.accountKey)!;
    console.log(
      `${batch.label}: ${batch.txns.length} transactions -> ${batch.accountKey}`,
    );

    for (const txn of batch.txns) {
      const result = await db
        .insert(transactions)
        .values({
          userId: user!.id,
          accountId,
          externalId: txn.externalId,
          date: txn.date,
          name: txn.name,
          merchantName: txn.merchantName,
          amount: txn.amount,
          category: txn.category,
          transactionType: txn.transactionType,
          isTransfer: txn.isTransfer,
          source: txn.source,
        })
        .onConflictDoNothing({
          target: [transactions.accountId, transactions.externalId],
        })
        .returning({ id: transactions.id });

      if (result.length > 0) inserted++;
      else skipped++;
    }
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions);

  console.log(`\nDone. Inserted: ${inserted}, skipped (duplicates): ${skipped}`);
  console.log(`Total transactions in database: ${count}`);

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
