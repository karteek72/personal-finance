import { cookies } from "next/headers";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
}

export async function getServerAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  const raw = jar.get("spendflow_access")?.value;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function fetchJsonServer<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getServerAccessToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: { message?: string } }).error?.message ===
        "string"
        ? (body as { error: { message: string } }).error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
