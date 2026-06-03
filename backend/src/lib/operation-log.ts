import type { Logger } from "pino";

/** High-level step names for grep-friendly log analysis. */
export type OperationStage =
  | "started"
  | "item_loaded"
  | "token_decrypted"
  | "institution_resolved"
  | "accounts_synced"
  | "transactions_page"
  | "cursor_saved"
  | "completed"
  | "failed"
  | "queued"
  | "skipped";

export interface OperationContext {
  operation: string;
  operationId: string;
  stage: OperationStage;
  userId?: string;
  userEmail?: string | null;
  plaidItemId?: string;
  itemDbId?: string;
  institutionName?: string | null;
  accountId?: string;
  accountName?: string | null;
  accountMask?: string | null;
  trigger?: string;
  requestId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export function logOperation(
  log: Logger,
  stage: OperationStage,
  message: string,
  context: Omit<OperationContext, "stage">,
): void {
  log.info({ ...context, stage }, message);
}

export function logOperationWarn(
  log: Logger,
  stage: OperationStage,
  message: string,
  context: Omit<OperationContext, "stage">,
): void {
  log.warn({ ...context, stage }, message);
}

export function logOperationError(
  log: Logger,
  stage: OperationStage,
  message: string,
  context: Omit<OperationContext, "stage">,
  error: unknown,
): void {
  log.error({ ...context, stage, err: error }, message);
}

export function createOperationTimer(): () => number {
  const started = Date.now();
  return () => Date.now() - started;
}
