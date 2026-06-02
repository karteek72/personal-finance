export function TransactionListHeader() {
  return (
    <div className="hidden border-b border-border bg-bg/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-muted sm:grid sm:grid-cols-[4rem_1fr_8rem_5rem_6rem] sm:gap-4">
      <span>Date</span>
      <span>Description</span>
      <span>Category</span>
      <span>Account</span>
      <span className="text-right">Amount</span>
    </div>
  );
}
