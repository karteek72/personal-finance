CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'other',
  avatar_color text NOT NULL DEFAULT '#7c3aed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS household_members_household_id_idx
  ON household_members(household_id);

CREATE TABLE IF NOT EXISTS household_account_assignments (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS household_account_assignments_member_id_idx
  ON household_account_assignments(member_id);

CREATE INDEX IF NOT EXISTS household_account_assignments_household_id_idx
  ON household_account_assignments(household_id);
