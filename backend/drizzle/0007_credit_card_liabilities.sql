CREATE TABLE IF NOT EXISTS credit_card_liabilities (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  last_statement_balance numeric(12, 2),
  last_statement_issue_date date,
  minimum_payment_amount numeric(12, 2),
  next_payment_due_date date,
  last_payment_amount numeric(12, 2),
  last_payment_date date,
  is_overdue boolean,
  aprs jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_card_liabilities_due_date_idx
  ON credit_card_liabilities (next_payment_due_date);
