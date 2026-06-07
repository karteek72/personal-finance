import { Worker, type Job } from "bullmq";
import type { Env } from "../config/env.js";
import { createLogger } from "../lib/logger.js";
import { logOperation, logOperationError } from "../lib/operation-log.js";
import { previewImportBatch } from "../services/import/process-import-batch.js";
import { purgeStaleImportBlobs } from "../services/import/purge-import-blobs.js";
import {
  getRedisConnectionOptions,
  IMPORT_BATCH_QUEUE_NAME,
  type ImportBatchJobData,
} from "./queue.js";

const log = createLogger("jobs.import-batch");

export function createImportBatchWorker(
  env: Env,
): Worker<ImportBatchJobData> | null {
  const connection = getRedisConnectionOptions(env);
  if (!connection) {
    return null;
  }

  const worker = new Worker<ImportBatchJobData>(
    IMPORT_BATCH_QUEUE_NAME,
    async (job: Job<ImportBatchJobData>) => {
      const { batchId } = job.data;

      logOperation(log, "started", "Processing import batch job", {
        operation: "import.batch_job",
        operationId: String(job.id),
        batchId,
      });

      try {
        const result = await previewImportBatch(batchId, env);
        void purgeStaleImportBlobs(env).catch(() => undefined);

        logOperation(log, "completed", "Import batch preview finished", {
          operation: "import.batch_job",
          operationId: String(job.id),
          batchId,
          filesProcessed: result.filesProcessed,
        });
      } catch (err) {
        logOperationError(
          log,
          "failed",
          "Import batch job failed",
          {
            operation: "import.batch_job",
            operationId: String(job.id),
            batchId,
          },
          err,
        );
        throw err;
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on("error", (err) => {
    log.error({ err }, "import batch worker error");
  });

  return worker;
}
