import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "sf-import-"));
  const pdfPath = join(dir, `${randomUUID()}.pdf`);

  try {
    writeFileSync(pdfPath, buffer);
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-layout", pdfPath, "-"],
      {
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf8",
      },
    );
    return stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function isPdftotextAvailable(): boolean {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
