-- Cross-provider duplicate account pairs dismissed by user (TASK-RECON-004)
CREATE TABLE IF NOT EXISTS account_duplicate_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_a_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_b_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_a_id, account_b_id)
);

CREATE INDEX IF NOT EXISTS account_duplicate_dismissals_user_idx
  ON account_duplicate_dismissals (user_id);

-- Push notification device tokens (TASK-IOS-002)
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON device_tokens (user_id);
