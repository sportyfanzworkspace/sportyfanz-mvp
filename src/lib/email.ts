import nodemailer from "nodemailer";
import { appendFile } from "node:fs/promises";

function isTestDatabaseConnection(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl || !testDatabaseUrl) {
    return false;
  }

  try {
    const current = new URL(databaseUrl);
    const test = new URL(testDatabaseUrl);

    const productionUrl = process.env.PRODUCTION_DATABASE_URL;

    if (productionUrl) {
      const production = new URL(productionUrl);

      if (
        current.hostname === production.hostname &&
        current.pathname === production.pathname
      ) {
        return false;
      }
    }

    return (
      current.hostname === test.hostname &&
      current.pathname === test.pathname &&
      current.username === test.username &&
      current.password === test.password &&
      current.port === test.port
    );
  } catch {
    return false;
  }
}

function isEmailTestMode(): boolean {
  if (process.env.SPORTYFANZ_EMAIL_TEST_MODE !== "1") {
    return false;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (
    process.env.NODE_ENV === "production" ||
    !databaseUrl ||
    !isTestDatabaseConnection()
  ) {
    throw new Error("Email test mode is not permitted.");
  }

  return true;
}


function getEmailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error("SMTP configuration is incomplete.");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid SMTP port.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendVerificationEmail(
  email: string,
  code: string
) {
  if (isEmailTestMode()) {
    const message = {
      to: email,
      code,
      capturedAt: new Date().toISOString(),
    };

    await appendFile(
      "/tmp/sportyfanz-test-verification-emails.jsonl",
      JSON.stringify(message) + "\n",
      { mode: 0o600 }
    );

    return;
  }

  const transport = getEmailTransport();

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Verify your SportyFanz email address",
    text: [
      "Welcome to SportyFanz!",
      "",
      `Your email verification code is: ${code}`,
      "",
      "This code expires in 10 minutes.",
      "If you did not create this account, ignore this email.",
      "",
      "SportyFanz",
      "Every Sport. Every Fan. Every Moment.",
    ].join("\n"),
  });
}


export async function sendStaffAccessEmail(
  email: string,
  username: string,
  actionUrl: string,
  purpose: "INVITATION" | "PASSWORD_RESET"
) {
  const parsedUrl = new URL(actionUrl);

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "www.sportyfanz.com" ||
    parsedUrl.pathname !== "/sf-vault-k8m42x/set-password/"
  ) {
    throw new Error("Invalid staff password setup URL.");
  }

  if (!parsedUrl.searchParams.get("token")) {
    throw new Error("Staff password setup token is missing.");
  }

  const invitation = purpose === "INVITATION";

  const subject = invitation
    ? "Your SportyFanz staff invitation"
    : "Reset your SportyFanz staff password";

  const heading = invitation
    ? "You have been invited to join the SportyFanz staff team."
    : "A password reset was requested for your SportyFanz staff account.";

  const text = [
    heading,
    "",
    `Username: ${username}`,
    "",
    invitation
      ? "Set your password using this secure link:"
      : "Create a new password using this secure link:",
    actionUrl,
    "",
    "This link expires in 1 hour and can only be used once.",
    "If you did not expect this email, contact your SportyFanz administrator.",
    "",
    "SportyFanz",
    "Every Sport. Every Fan. Every Moment.",
  ].join("\n");

  if (isEmailTestMode()) {
    await appendFile(
      "/tmp/sportyfanz-test-staff-emails.jsonl",
      JSON.stringify({
        to: email,
        username,
        actionUrl,
        purpose,
        capturedAt: new Date().toISOString(),
      }) + "\n",
      { mode: 0o600 }
    );

    return;
  }

  const transport = getEmailTransport();

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
  });
}
