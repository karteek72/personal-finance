#!/usr/bin/env npx tsx
/**
 * Dev helper: log device tokens for a user and simulate a test push payload.
 * Real APNs delivery requires APNS_* env vars (not wired in MVP).
 *
 * Usage: npx tsx scripts/send-test-push.ts <user-email>
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { listDeviceTokensForUser } from "../src/services/device-tokens.js";

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/send-test-push.ts <user-email>");
    process.exit(1);
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const tokens = await listDeviceTokensForUser(user.id);
  if (tokens.length === 0) {
    console.log(`No device tokens for ${email}`);
    process.exit(0);
  }

  const payload = {
    aps: {
      alert: {
        title: "SpendFlow test",
        body: "Test push — alert severity ≥ warning",
      },
      sound: "default",
    },
    severity: "warning",
  };

  for (const row of tokens) {
    console.log(
      JSON.stringify(
        {
          userId: user.id,
          deviceId: row.id,
          platform: row.platform,
          tokenPreview: `${row.token.slice(0, 8)}…`,
          payload,
          note: "APNs not configured — payload logged only",
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
