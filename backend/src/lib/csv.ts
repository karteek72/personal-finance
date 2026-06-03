/** Escape a single CSV field per RFC 4180. */
export function escapeCsvField(value: string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Join escaped fields into one CSV row (no trailing newline). */
export function formatCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",");
}
