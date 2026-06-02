const LINK_TOKEN_KEY = "spendflow_plaid_link_token";

export function storePlaidLinkToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LINK_TOKEN_KEY, token);
}

export function getPlaidLinkToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LINK_TOKEN_KEY);
}

export function clearPlaidLinkToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LINK_TOKEN_KEY);
}

export function getPlaidRedirectUri(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${appUrl}/plaid/oauth`;
}
