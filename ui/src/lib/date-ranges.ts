/** Rolling window aligned with Plaid's max transaction history (730 days). */
export function plaidHistoryDateRange(): { from: string; to: string } {
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 730);
  return {
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
  };
}

/** Calendar year (used where a YTD view is intentional). */
export function calendarYearDateRange(year = new Date().getFullYear()): {
  from: string;
  to: string;
} {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}
