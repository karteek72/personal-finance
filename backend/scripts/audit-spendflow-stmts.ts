/**
 * Parse every file under SpendFlow-stmts/ and report transaction counts or errors.
 *
 * Usage: cd backend && npx tsx scripts/audit-spendflow-stmts.ts [root-dir]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseImportFileAsync } from "../src/services/import/parse-file.js";

const ROOT = process.argv[2] ?? join(process.cwd(), "..", "SpendFlow-stmts");

interface Row {
  path: string;
  format: string;
  banking: number;
  investment: number;
  formatVersion: string;
  warnings: string;
  error?: string;
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
}

function formatForExt(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".qfx") || lower.endsWith(".ofx")) return "ofx";
  return null;
}

async function main(): Promise<void> {
  const files: string[] = [];
  try {
    walk(ROOT, files);
  } catch (err) {
    console.error(`Cannot read ${ROOT}:`, err);
    process.exit(1);
  }

  files.sort();
  const rows: Row[] = [];
  let ok = 0;
  let fail = 0;

  for (const full of files) {
    const rel = relative(ROOT, full);
    const fmt = formatForExt(full);
    if (!fmt) continue;

    try {
      const input =
        fmt === "pdf" ? readFileSync(full) : readFileSync(full, "utf8");
      const statements = await parseImportFileAsync(fmt, input, rel);
      for (const stmt of statements) {
        const banking = stmt.bankingTransactions.length;
        const investment = stmt.investmentTransactions.length;
        rows.push({
          path: rel,
          format: fmt,
          banking,
          investment,
          formatVersion: stmt.formatVersion,
          warnings: stmt.warnings.join("; ") || "—",
        });
        if (banking + investment > 0 || stmt.warnings.length > 0) {
          ok++;
        } else {
          fail++;
        }
      }
    } catch (err) {
      fail++;
      rows.push({
        path: rel,
        format: fmt,
        banking: 0,
        investment: 0,
        formatVersion: "—",
        warnings: "—",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const w = Math.max(12, ...rows.map((r) => r.path.length));
  console.log(`\nSpendFlow statement audit: ${ROOT}\n`);
  console.log(
    `${"File".padEnd(w)}  ${"Fmt".padEnd(4)}  ${"Bank".padStart(5)}  ${"Inv".padStart(4)}  Version / Error`,
  );
  console.log("-".repeat(w + 60));

  for (const r of rows) {
    if (r.error) {
      console.log(
        `${r.path.padEnd(w)}  ${r.format.padEnd(4)}  ${"—".padStart(5)}  ${"—".padStart(4)}  ERROR: ${r.error}`,
      );
    } else {
      console.log(
        `${r.path.padEnd(w)}  ${r.format.padEnd(4)}  ${String(r.banking).padStart(5)}  ${String(r.investment).padStart(4)}  ${r.formatVersion}${r.warnings !== "—" ? ` (${r.warnings})` : ""}`,
      );
    }
  }

  console.log(`\nFiles parsed: ${rows.length}, with data or warnings: ${ok}, failed or empty: ${fail}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
