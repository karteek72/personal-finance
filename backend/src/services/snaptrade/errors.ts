import { AppError } from "../../lib/errors.js";

interface SnaptradeApiErrorBody {
  detail?: string;
  code?: string;
  status_code?: number;
}

function readSnaptradeResponseBody(error: unknown): SnaptradeApiErrorBody | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "responseBody" in error &&
    typeof (error as { responseBody?: unknown }).responseBody === "object" &&
    (error as { responseBody?: unknown }).responseBody !== null
  ) {
    return (error as { responseBody: SnaptradeApiErrorBody }).responseBody;
  }
  return null;
}

export function toSnaptradeAppError(
  error: unknown,
  fallbackMessage: string,
): AppError {
  if (error instanceof AppError) return error;

  const body = readSnaptradeResponseBody(error);

  if (body?.code === "1012") {
    return AppError.snaptradeError(
      "SnapTrade personal API keys support one registered user. Set SNAPTRADE_SHARED_USER_ID and SNAPTRADE_SHARED_USER_SECRET in .env for local development.",
      error,
    );
  }

  if (body?.code === "1076") {
    return AppError.snaptradeError(
      "SnapTrade rejected the API credentials (invalid signature). Verify SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY match your SnapTrade dashboard exactly.",
      error,
    );
  }

  if (body?.detail) {
    return AppError.snaptradeError(body.detail, error);
  }

  return AppError.snaptradeError(fallbackMessage, error);
}
