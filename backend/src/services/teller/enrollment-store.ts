import { and, desc, eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { accounts, tellerEnrollments } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { decryptTellerToken, encryptTellerToken } from "./crypto.js";
import { syncTellerEnrollment } from "./sync.js";

export async function upsertTellerEnrollment(
  userId: string,
  params: {
    accessToken: string;
    enrollmentId: string;
    institutionName?: string;
  },
  env: Env,
) {
  const db = getDb();
  const encrypted = encryptTellerToken(params.accessToken, env);

  const existing = await db
    .select()
    .from(tellerEnrollments)
    .where(eq(tellerEnrollments.tellerEnrollmentId, params.enrollmentId))
    .limit(1);

  let enrollmentRow;
  if (existing[0]) {
    const [updated] = await db
      .update(tellerEnrollments)
      .set({
        accessTokenEncrypted: encrypted,
        institutionName: params.institutionName ?? existing[0].institutionName,
        status: "active",
      })
      .where(eq(tellerEnrollments.id, existing[0].id))
      .returning();
    enrollmentRow = updated!;
    await db
      .update(accounts)
      .set({ status: "active" })
      .where(eq(accounts.tellerEnrollmentId, enrollmentRow.id));
  } else {
    const [created] = await db
      .insert(tellerEnrollments)
      .values({
        userId,
        tellerEnrollmentId: params.enrollmentId,
        accessTokenEncrypted: encrypted,
        institutionName: params.institutionName ?? null,
        status: "active",
      })
      .returning();
    enrollmentRow = created!;
  }

  const syncResult = await syncTellerEnrollment(enrollmentRow.id, env);
  return { enrollment: enrollmentRow, syncResult };
}

export async function getTellerAccessToken(
  enrollmentDbId: string,
  userId: string,
  env: Env,
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ accessTokenEncrypted: tellerEnrollments.accessTokenEncrypted })
    .from(tellerEnrollments)
    .where(
      and(
        eq(tellerEnrollments.id, enrollmentDbId),
        eq(tellerEnrollments.userId, userId),
      ),
    )
    .limit(1);

  if (!row) {
    throw AppError.notFound("Teller enrollment not found");
  }

  return decryptTellerToken(row.accessTokenEncrypted, env);
}

export async function listTellerEnrollments(userId: string) {
  const db = getDb();
  return db
    .select({
      id: tellerEnrollments.id,
      tellerEnrollmentId: tellerEnrollments.tellerEnrollmentId,
      institutionName: tellerEnrollments.institutionName,
      status: tellerEnrollments.status,
      lastSyncedAt: tellerEnrollments.lastSyncedAt,
      createdAt: tellerEnrollments.createdAt,
    })
    .from(tellerEnrollments)
    .where(eq(tellerEnrollments.userId, userId))
    .orderBy(desc(tellerEnrollments.createdAt));
}

export async function deleteTellerEnrollment(
  enrollmentDbId: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: tellerEnrollments.id })
    .from(tellerEnrollments)
    .where(
      and(
        eq(tellerEnrollments.id, enrollmentDbId),
        eq(tellerEnrollments.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return false;

  await db
    .delete(accounts)
    .where(eq(accounts.tellerEnrollmentId, enrollmentDbId));
  await db.delete(tellerEnrollments).where(eq(tellerEnrollments.id, enrollmentDbId));
  return true;
}
