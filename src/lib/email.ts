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
