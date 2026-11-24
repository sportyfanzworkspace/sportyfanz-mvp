import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/prisma";

export type StaffAccessPurpose = "INVITATION" | "PASSWORD_RESET";

export const STAFF_ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

const STAFF_PASSWORD_SETUP_URL =
  "https://www.sportyfanz.com/sf-vault-k8m42x/set-password/";

export function hashStaffAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createStaffPasswordSetupUrl(token: string): string {
  const url = new URL(STAFF_PASSWORD_SETUP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createStaffAccessToken(
  adminUserId: number,
  purpose: StaffAccessPurpose
) {
  if (!Number.isSafeInteger(adminUserId) || adminUserId < 1) {
    throw new Error("Invalid staff account ID.");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashStaffAccessToken(token);

  const expiresAt = new Date(
    Date.now() + STAFF_ACCESS_TOKEN_LIFETIME_MS
  ).toISOString();

  const record = await db.transaction(async (tx) => {
    const now = new Date().toISOString();

    // Serialize token issuance for this staff account.
    const admin = await tx.orm.public.AdminUser
      .where({ id: adminUserId })
      .update({ updatedAt: now });

    if (
      !admin ||
      admin.status !== "ACTIVE" ||
      admin.role !== "ADMIN"
    ) {
      throw new Error("STAFF_ACCOUNT_UNAVAILABLE");
    }

    // Invalidate all previous unused links.
    for await (
      const _previousToken of tx.orm.public.AdminPasswordResetToken
        .where({ adminUserId })
        .where((row) => row.usedAt.isNull())
        .updateAll({ usedAt: now })
    ) {
      // Consume the update stream inside the transaction.
    }

    return tx.orm.public.AdminPasswordResetToken.create({
      adminUserId,
      tokenHash,
      purpose,
      expiresAt,
    });
  });

  return {
    id: record.id,
    token,
    expiresAt,
    actionUrl: createStaffPasswordSetupUrl(token),
  };
}

/**
 * Cancel a newly issued staff access token after an email
 * delivery failure. Never reactivate older tokens.
 *
 * This operation is safe to repeat.
 */
export async function cancelStaffAccessToken(
  tokenId: number,
  adminUserId: number
): Promise<void> {
  if (
    !Number.isSafeInteger(tokenId) ||
    tokenId < 1 ||
    !Number.isSafeInteger(adminUserId) ||
    adminUserId < 1
  ) {
    throw new Error("Invalid staff token cancellation request.");
  }

  await db.orm.public.AdminPasswordResetToken
    .where({ id: tokenId, adminUserId })
    .where((record) => record.usedAt.isNull())
    .update({
      usedAt: new Date().toISOString(),
    });
}

export type StaffTokenRedemptionResult =
  | { success: true }
  | {
      success: false;
      reason: "INVALID_TOKEN" | "EXPIRED_TOKEN" | "INACTIVE_STAFF";
    };

export async function redeemStaffAccessToken(
  token: string,
  newPasswordHash: string
): Promise<StaffTokenRedemptionResult> {
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return { success: false, reason: "INVALID_TOKEN" };
  }

  const tokenHash = hashStaffAccessToken(token);
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const record =
      await tx.orm.public.AdminPasswordResetToken.first({
        tokenHash,
      });

    if (!record || record.usedAt !== null) {
      return { success: false, reason: "INVALID_TOKEN" } as const;
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      return { success: false, reason: "EXPIRED_TOKEN" } as const;
    }

    const admin = await tx.orm.public.AdminUser.first({
      id: record.adminUserId,
    });

    if (
      !admin ||
      admin.status !== "ACTIVE" ||
      admin.role !== "ADMIN"
    ) {
      return { success: false, reason: "INACTIVE_STAFF" } as const;
    }

    // Lock the parent staff row before consuming token records.
    // This matches the locking order used during token issuance.
    const lockedAdmin = await tx.orm.public.AdminUser
      .where({
        id: admin.id,
        sessionVersion: admin.sessionVersion,
      })
      .update({ updatedAt: now });

    if (
      !lockedAdmin ||
      lockedAdmin.status !== "ACTIVE" ||
      lockedAdmin.role !== "ADMIN"
    ) {
      return { success: false, reason: "INACTIVE_STAFF" } as const;
    }

    const consumed =
      await tx.orm.public.AdminPasswordResetToken
        .where((tokenRecord) =>
          tokenRecord.id.eq(record.id)
        )
        .where((tokenRecord) =>
          tokenRecord.usedAt.isNull()
        )
        .where((tokenRecord) =>
          tokenRecord.expiresAt.gt(new Date().toISOString())
        )
        .update({
          usedAt: new Date().toISOString(),
        });

    if (!consumed) {
      return { success: false, reason: "INVALID_TOKEN" } as const;
    }

    const updatedAdmin = await tx.orm.public.AdminUser.where({
      id: admin.id,
      sessionVersion: admin.sessionVersion,
    }).update({
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      sessionVersion: admin.sessionVersion + 1,
      updatedAt: now,
    });

    if (!updatedAdmin) {
      throw new Error("STAFF_TOKEN_PASSWORD_UPDATE_CONFLICT");
    }

    // Invalidate every remaining unused invitation or reset link
    // for this staff account after the password has changed.
    for await (
      const _remainingToken of tx.orm.public.AdminPasswordResetToken
        .where({ adminUserId: admin.id })
        .where((tokenRecord) => tokenRecord.usedAt.isNull())
        .updateAll({ usedAt: now })
    ) {
      // Consume the update stream inside the transaction.
    }

    return { success: true } as const;
  });
}
