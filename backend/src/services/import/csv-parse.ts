/** Minimal RFC4180-style CSV parser (quoted fields, comma delimiter). */
export function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((c) => c.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      if (ch === "\r") {
        i++;
      }
      continue;
    }

    if (ch === "\r") {
      row.push(field);
      field = "";
      if (row.some((c) => c.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim().length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export function headerIndexMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    map.set(normalizeHeader(h), i);
  });
  return map;
}

export function rowValue(
  row: string[],
  map: Map<string, number>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const idx = map.get(normalizeHeader(key));
    if (idx !== undefined) {
      return (row[idx] ?? "").trim();
    }
  }
  return "";
}

export function parseMoney(raw: string): string {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned || cleaned === "-") {
    return "0.00";
  }
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) {
    return "0.00";
  }
  return Math.abs(n).toFixed(2);
}

export function parseSignedMoney(raw: string): string {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) {
    return "0.00";
  }
  const paren = /^\(.*\)$/.test(cleaned);
  const n = Number.parseFloat(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(n)) {
    return "0.00";
  }
  const signed = paren ? -Math.abs(n) : n;
  return signed.toFixed(2);
}

export function parseDateUs(raw: string): string | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const mm = slash[1]!.padStart(2, "0");
    const dd = slash[2]!.padStart(2, "0");
    let yyyy = slash[3]!;
    if (yyyy.length === 2) {
      yyyy = `20${yyyy}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  const mon = t.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (mon) {
    const months: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const m = months[mon[1]!.toLowerCase()];
    if (m) {
      return `${mon[3]}-${m}-${mon[2]!.padStart(2, "0")}`;
    }
  }

  return null;
}

export function maskFromAccountId(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  if (raw.length >= 4) {
    return raw.slice(-4);
  }
  return "0000";
}
