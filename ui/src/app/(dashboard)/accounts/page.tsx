import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";

export default async function AccountsPage() {
  const { accounts } = await api.getAccounts();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Connected</h2>
          <p className="text-sm text-text-muted">
            Institutions, balances, and sync status
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-[var(--radius-card)] border border-primary bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Connect Account
        </button>
      </header>

      {accounts.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-base font-medium text-text">No accounts connected</p>
          <p className="mt-1 text-sm text-text-muted">
            Connect your first bank or credit card to start tracking spending.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-card)] border border-primary bg-primary px-4 py-2 text-sm font-medium text-text-inverse"
          >
            Connect Account
          </button>
        </div>
      ) : (
        <section
          aria-label="Connected accounts"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {accounts.map((account) => (
            <article
              key={account.id}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-text">
                    {account.name}
                  </h3>
                  <p className="truncate text-sm text-text-muted">
                    {account.institutionName}
                    {account.mask ? ` ·••• ${account.mask}` : null}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium capitalize ${
                    account.status === "active"
                      ? "bg-success/15 text-success"
                      : account.status === "reauth_required"
                        ? "bg-warning/15 text-warning"
                        : "bg-danger/15 text-danger"
                  }`}
                >
                  {account.status.replace("_", " ")}
                </span>
              </div>

              <p
                className="mt-4 font-mono text-xl font-medium tabular-nums text-text"
                data-money
              >
                {formatMoney(account.balanceCurrent)}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
                <div>
                  <dt>Type</dt>
                  <dd className="mt-0.5 capitalize text-text">
                    {account.subtype ?? account.type}
                  </dd>
                </div>
                <div>
                  <dt>Last synced</dt>
                  <dd className="mt-0.5 text-text">
                    {account.lastSyncedAt
                      ? new Date(account.lastSyncedAt).toLocaleDateString()
                      : "Never"}
                  </dd>
                </div>
              </dl>

              {account.status === "reauth_required" ? (
                <button
                  type="button"
                  className="mt-4 w-full rounded-[var(--radius-card)] border border-warning px-3 py-1.5 text-sm font-medium text-warning"
                >
                  Reconnect
                </button>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
