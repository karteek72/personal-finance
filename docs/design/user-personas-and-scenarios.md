# User Personas & Scenarios

**Product:** SpendFlow  
**Last Updated:** May 2026

---

## Personas

| Persona | Description | Key need |
|---------|-------------|----------|
| **Active Multi-Card User** | 2–5 credit cards, 1–2 bank accounts, earns $80K–$200K | Spend visibility, category breakdown |
| **Savings-Focused User** | Tracks monthly savings rate, invests surplus | Net flow, savings rate alerts |
| **Budget Optimizer** | Wants to cut subscriptions and dining | Anomaly alerts, trend comparison |

---

## Daily-use scenarios

### Morning check-in (2 minutes)

1. Open Dashboard on phone.
2. Glance at **Total Spent** and **Net Savings** for current month.
3. Dismiss or read one smart alert (e.g. dining up 18%).

**Requirements:** Mobile layout, fast load, month filter defaults to current month.

### Weekly review (10 minutes)

1. Open **Categories** — scan proportional bar and top categories.
2. Open **Transactions** — filter by category, fix one mis-categorized merchant.
3. Export CSV if needed for external spreadsheet.

**Requirements:** Re-categorization persists; transfer rows clearly marked excluded from spend.

### Month-end reconciliation (15 minutes)

1. Open **Money Flow** — confirm CC payments excluded from expenses.
2. Compare income vs expenses trend chart.
3. Verify all accounts show green sync status on **Accounts** page.

**Requirements:** Reconciliation banner always visible on Money Flow; reconnect CTA when Plaid item errors.

### New user onboarding (< 5 minutes)

1. Register / sign in.
2. Connect Chase checking + one credit card via Plaid Link.
3. Wait for initial transaction sync.
4. Land on Dashboard with first insights.

**Requirements:** Time-to-first-insight KPI; skeleton loaders during sync.

---

## Out of scope for MVP personas

- Household sharing (V2)
- Investment portfolio tracking (V2)
- Per-category budget limits (V2 — Budget Optimizer partially served by alerts only)
