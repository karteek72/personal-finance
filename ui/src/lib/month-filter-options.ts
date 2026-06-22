/** Last N calendar months (newest first) for activity filters. */
export function buildRecentMonthFilterOptions(
  monthsBack = 12,
  allowAll = true,
): {
  value: string;
  label: string;
}[] {
  const options: { value: string; label: string }[] = allowAll
    ? [{ value: "", label: "All months" }]
    : [];
  const now = new Date();

  for (let offset = 0; offset < monthsBack; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const value = `${year}-${String(month).padStart(2, "0")}`;
    const label = date.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
    options.push({ value, label });
  }

  return options;
}
