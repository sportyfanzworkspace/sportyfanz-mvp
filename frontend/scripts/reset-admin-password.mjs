
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { db } from "../src/prisma/db.ts";

const rl = createInterface({ input: stdin, output: stdout });

try {
  await db.connect();

  const identifier = (
    await rl.question("Existing administrator username or email: ")
  )
    .trim()
    .toLowerCase();

  if (!identifier) {
    throw new Error("Enter the existing administrator username or email.");
  }

  const admin = await db.orm.public.AdminUser.first({
    username: identifier,
  });

  const account =
    admin ?? (await db.orm.public.AdminUser.first({ email: identifier }));

  if (!account) {
    throw new Error(
      "Administrator not found. No account was changed."
    );
  }

  const temporaryPassword =
    `${randomBytes(18).toString("base64url")}A7!`;

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await db.orm.public.AdminUser.where({ id: account.id }).update({
    passwordHash,
    mustChangePassword: true,
    updatedAt: new Date().toISOString(),
  });

  console.log("\nAdministrator password reset successfully.");
  console.log(`Username: ${account.username}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log("\nSign in at: /admin/login");
  console.log("You must change this password after signing in.");
} catch (error) {
  console.error(
    "\nPassword reset failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
} finally {
  rl.close();
  await db.close().catch(() => {});
}
