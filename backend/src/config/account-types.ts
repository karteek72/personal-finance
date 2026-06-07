/** Account `type` values that reduce net worth (Plaid + imports). */
export const LIABILITY_ACCOUNT_TYPES = ["credit", "loan"] as const;

/** Account `type` values counted as assets in net worth. */
export const ASSET_ACCOUNT_TYPES = [
  "depository",
  "investment",
  "brokerage",
] as const;

export type LiabilityAccountType = (typeof LIABILITY_ACCOUNT_TYPES)[number];
export type AssetAccountType = (typeof ASSET_ACCOUNT_TYPES)[number];

const LIABILITY_SET = new Set<string>(LIABILITY_ACCOUNT_TYPES);
const ASSET_SET = new Set<string>(ASSET_ACCOUNT_TYPES);

export function isLiabilityAccountType(type: string): type is LiabilityAccountType {
  return LIABILITY_SET.has(type);
}

export function isAssetAccountType(type: string): type is AssetAccountType {
  return ASSET_SET.has(type);
}

/** Split a balance into asset vs liability buckets for net worth. Unknown types are excluded. */
export function splitBalanceForNetWorth(
  type: string,
  balance: number,
): { assets: number; liabilities: number } {
  if (!Number.isFinite(balance)) {
    return { assets: 0, liabilities: 0 };
  }
  if (isLiabilityAccountType(type)) {
    return { assets: 0, liabilities: Math.abs(balance) };
  }
  if (isAssetAccountType(type)) {
    return { assets: balance, liabilities: 0 };
  }
  return { assets: 0, liabilities: 0 };
}
