
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { db } from "../src/prisma/db.ts";

const rl = createInterface({ input: stdin, output: stdout });

try {
  await db.connect();

  const name = (await rl.question("Administrator full name: ")).trim();
  const email = (await rl.question("Administrator work email: "))
    .trim()
    .toLowerCase();

  if (!name || !email || !email.includes("@")) {
    throw new Error("Please enter a valid name and email address.");
  }

  const existing = await db.orm.public.AdminUser.first({ email });

  if (existing) {
    throw new Error(
      "An administrator with that email already exists. No account was created."
    );
  }

  const usernameBase =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "admin";
  const username =
    `${usernameBase}${randomBytes(3).toString("hex")}`;

  const temporaryPassword =
    `${randomBytes(18).toString("base64url")}A7!`;

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const admin = await db.orm.public.AdminUser.create({
    name,
    email,
    username,
    passwordHash,
    mustChangePassword: true,
    role: "ADMIN",
    status: "ACTIVE",
  });

  console.log("\nAdministrator account created successfully.");
  console.log(`Name: ${admin.name}`);
  console.log(`Email: ${admin.email}`);
  console.log(`Username: ${admin.username}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log("\nSave these credentials securely. The password will not be shown again.");
  console.log("Sign in at: /admin/login");
  console.log("You will be required to change the password on first login.");
} catch (error) {
  console.error(
    "\nBootstrap failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
} finally {
  rl.close();
  await db.close().catch(() => {});
}
