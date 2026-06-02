/**
 * Typed HTTP errors mapped to api-contract.md `{ error: { code, message, details? } }`.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AUTH_NOT_CONFIGURED"
  | "GOOGLE_AUTH_FAILED"
  | "PLAID_ERROR"
  | "PLAID_SYNC_ERROR"
  | "NOT_PLAID_ACCOUNT"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    code: ErrorCode,
    statusCode: number,
    message: string,
    options?: { cause?: unknown; details?: unknown; expose?: boolean },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = options?.details;
    this.expose = options?.expose ?? true;
  }

  toJSON(): ApiErrorBody {
    const body: ApiErrorBody = {
      error: {
        code: this.code,
        message: this.message,
      },
    };
    if (this.details !== undefined) {
      body.error.details = this.details;
    }
    return body;
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError("VALIDATION_ERROR", 400, message, { details });
  }

  static unauthenticated(message = "Sign in required"): AppError {
    return new AppError("UNAUTHENTICATED", 401, message);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError("FORBIDDEN", 403, message);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError("NOT_FOUND", 404, message);
  }

  static authNotConfigured(message: string): AppError {
    return new AppError("AUTH_NOT_CONFIGURED", 503, message);
  }

  static googleAuthFailed(cause?: unknown): AppError {
    return new AppError("GOOGLE_AUTH_FAILED", 401, "Could not verify Google sign-in", {
      cause,
      expose: true,
    });
  }

  static plaidError(message: string, cause?: unknown): AppError {
    return new AppError("PLAID_ERROR", 502, message, { cause });
  }

  static plaidSyncError(message: string, cause?: unknown): AppError {
    return new AppError("PLAID_SYNC_ERROR", 502, message, { cause });
  }

  static notPlaidAccount(): AppError {
    return new AppError(
      "NOT_PLAID_ACCOUNT",
      400,
      "Only Plaid-linked accounts can be synced",
    );
  }

  static internal(cause?: unknown): AppError {
    return new AppError("INTERNAL_ERROR", 500, "An unexpected error occurred", {
      cause,
      expose: false,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
