import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  createStaffPasswordSetupUrl,
  hashStaffAccessToken,
  STAFF_ACCESS_TOKEN_LIFETIME_MS,
} from "@/lib/admin/staff-access-tokens";
import type { StaffRole } from "@/lib/admin/require-admin";

export async function createInvitedStaff(input: {
  name: string;
  email: string;
  username: string;
  staffRole: StaffRole;
}) {
  const unusablePassword = randomBytes(48).toString("base64url");
  const passwordHash = await hashPassword(unusablePassword);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashStaffAccessToken(token);

  const expiresAt = new Date(
    Date.now() + STAFF_ACCESS_TOKEN_LIFETIME_MS
  ).toISOString();

  const result = await db.transaction(async (tx) => {
    const staff = await tx.orm.public.AdminUser.create({
      email: input.email,
      username: input.username,
      name: input.name,
      passwordHash,
      role: "ADMIN",
      staffRole: input.staffRole,
      status: "ACTIVE",
      mustChangePassword: true,
    });

    const invitationToken =
      await tx.orm.public.AdminPasswordResetToken.create({
        adminUserId: staff.id,
        tokenHash,
        purpose: "INVITATION",
        expiresAt,
      });

    return { staff, tokenId: invitationToken.id };
  });

  return {
    admin: result.staff,
    tokenId: result.tokenId,
    actionUrl: createStaffPasswordSetupUrl(token),
    expiresAt,
  };
}
