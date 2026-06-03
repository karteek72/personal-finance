export type ImportFileFormat = "qfx" | "ofx" | "csv" | "pdf" | "unknown";

const OFX_HEADER = /OFXHEADER:\s*100/i;
const OFX_TAG = /<OFX>/i;
const PDF_MAGIC = /^%PDF-/;

export function detectImportFormat(
  filename: string,
  head: Buffer,
): ImportFileFormat {
  const ext = extensionOf(filename);
  const textHead = head.subarray(0, Math.min(head.length, 4096)).toString("utf8");

  if (ext === ".pdf" || PDF_MAGIC.test(textHead)) {
    return "pdf";
  }

  if (
    ext === ".qfx" ||
    ext === ".ofx" ||
    OFX_HEADER.test(textHead) ||
    OFX_TAG.test(textHead)
  ) {
    return ext === ".qfx" ? "qfx" : "ofx";
  }

  if (ext === ".csv") {
    return "csv";
  }

  return "unknown";
}

export function extensionOf(filename: string): string {
  const lower = filename.toLowerCase();
  const idx = lower.lastIndexOf(".");
  if (idx <= 0) {
    return "";
  }
  return lower.slice(idx);
}

export function isAllowedImportExtension(filename: string): boolean {
  const ext = extensionOf(filename);
  return ext === ".qfx" || ext === ".ofx" || ext === ".csv" || ext === ".pdf";
}
