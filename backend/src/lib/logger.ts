import pino, { type Logger, type LoggerOptions } from "pino";

let rootLogger: Logger | null = null;

export function createRootLogger(level: string): Logger {
  const options: LoggerOptions = {
    level,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "authorization",
        "accessToken",
        "refreshToken",
        "idToken",
        "publicToken",
        "access_token",
        "PLAID_SECRET",
        "JWT_SECRET",
        "ENCRYPTION_KEY",
        "password",
      ],
      censor: "[Redacted]",
    },
  };

  rootLogger = pino(options);
  return rootLogger;
}

export function getRootLogger(): Logger {
  if (!rootLogger) {
    rootLogger = createRootLogger(
      process.env.NODE_ENV === "production" ? "info" : "debug",
    );
  }
  return rootLogger;
}

/** Child logger for a module (e.g. `plaid.sync`). Use in services and scripts. */
export function createLogger(module: string): Logger {
  return getRootLogger().child({ module });
}
