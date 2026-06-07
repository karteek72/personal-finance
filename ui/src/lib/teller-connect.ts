const TELLER_SCRIPT_SRC = "https://cdn.teller.io/connect/connect.js";

declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: {
        applicationId: string;
        environment?: "sandbox" | "development" | "production";
        products: string[];
        enrollmentId?: string;
        onSuccess: (enrollment: TellerEnrollmentPayload) => void;
        onExit?: () => void;
      }) => TellerConnectHandle;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadTellerConnectScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Teller Connect requires a browser"));
  }

  if (window.TellerConnect) {
    return Promise.resolve();
  }

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${TELLER_SCRIPT_SRC}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Failed to load Teller Connect")),
        );
        return;
      }

      const script = document.createElement("script");
      script.src = TELLER_SCRIPT_SRC;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Teller Connect script"));
      document.body.appendChild(script);
    });
  }

  return scriptPromise;
}

export interface TellerEnrollmentPayload {
  accessToken: string;
  enrollment: {
    id: string;
    institution?: { name?: string };
  };
}

export interface TellerConnectHandle {
  open: () => void;
}

export async function createTellerConnectHandle(
  config: {
    applicationId: string;
    environment: "sandbox" | "development" | "production";
    products: string[];
    enrollmentId?: string;
    onSuccess: (enrollment: TellerEnrollmentPayload) => void;
    onExit?: () => void;
  },
): Promise<TellerConnectHandle> {
  await loadTellerConnectScript();

  if (!window.TellerConnect) {
    throw new Error("Teller Connect is not available");
  }

  return window.TellerConnect.setup({
    applicationId: config.applicationId,
    environment: config.environment,
    products: config.products,
    enrollmentId: config.enrollmentId,
    onSuccess: config.onSuccess,
    onExit: config.onExit ?? (() => undefined),
  });
}
