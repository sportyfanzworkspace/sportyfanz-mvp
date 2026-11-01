
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Validate YYYY-MM-DD and ensure the date is not in the future.
function isValidDateOfBirth(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);

  return value <= today;
}

// Basic international/local WhatsApp number validation.
function normalizeWhatsAppNumber(value: string): string | null {
  const cleaned = value.trim().replace(/[\s()-]/g, "");

  if (!/^\+?\d{7,15}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

// GET: Return the signed-in fan's own KYC submission history.
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User.where({ id: userId }).first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    const submissions = await db.orm.public.KycSubmission
      .where({ userId })
      .all();

    const sortedSubmissions = [...submissions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

    const hasApprovedSubmission = submissions.some(
      (submission) => submission.status === "APPROVED"
    );

    const hasPendingSubmission = submissions.some(
      (submission) => submission.status === "PENDING"
    );

    return NextResponse.json(
      {
        submissions: sortedSubmissions,
        latestSubmission: sortedSubmissions[0] ?? null,
        hasApprovedSubmission,
        hasPendingSubmission,
        canSubmit:
          !hasApprovedSubmission && !hasPendingSubmission,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("KYC GET error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve your KYC information." },
      { status: 500 }
    );
  }
}

// POST: Submit KYC information for admin review.
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User.where({ id: userId }).first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid KYC information." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const whatsappInput =
      typeof data.whatsappNumber === "string"
        ? data.whatsappNumber
        : "";

    const country =
      typeof data.country === "string"
        ? data.country.trim()
        : "";

    const state =
      typeof data.state === "string"
        ? data.state.trim()
        : "";

    const sex = data.sex;

    const dateOfBirth =
      typeof data.dateOfBirth === "string"
        ? data.dateOfBirth.trim()
        : "";

    // Validate required fields.
    if (
      !whatsappInput.trim() ||
      !country ||
      !state ||
      !dateOfBirth ||
      !sex
    ) {
      return NextResponse.json(
        { error: "Please complete all required KYC fields." },
        { status: 400 }
      );
    }

    // Validate WhatsApp number.
    const whatsappNumber =
      normalizeWhatsAppNumber(whatsappInput);

    if (!whatsappNumber) {
      return NextResponse.json(
        {
          error:
            "Enter a valid WhatsApp number using 7 to 15 digits, with an optional + country prefix.",
        },
        { status: 400 }
      );
    }

    // Only FEMALE and MALE are accepted.
    if (sex !== "FEMALE" && sex !== "MALE") {
      return NextResponse.json(
        { error: "Please select FEMALE or MALE." },
        { status: 400 }
      );
    }

    // Validate date of birth.
    if (!isValidDateOfBirth(dateOfBirth)) {
      return NextResponse.json(
        { error: "Enter a valid date of birth." },
        { status: 400 }
      );
    }

    // Prevent excessively long input.
    if (
      whatsappNumber.length > 20 ||
      country.length > 100 ||
      state.length > 100
    ) {
      return NextResponse.json(
        { error: "One or more fields exceed the allowed length." },
        { status: 400 }
      );
    }

    // Check existing submissions.
    const existingSubmissions =
      await db.orm.public.KycSubmission
        .where({ userId })
        .all();

    const alreadyApproved = existingSubmissions.some(
      (submission) => submission.status === "APPROVED"
    );

    if (alreadyApproved) {
      return NextResponse.json(
        {
          error: "Your KYC has already been approved.",
          status: "APPROVED",
        },
        { status: 409 }
      );
    }

    const alreadyPending = existingSubmissions.some(
      (submission) => submission.status === "PENDING"
    );

    if (alreadyPending) {
      return NextResponse.json(
        {
          error: "You already have a KYC submission awaiting review.",
          status: "PENDING",
        },
        { status: 409 }
      );
    }

    // Create a new submission.
    // No identity documents or photographs are collected.
    const submission = await db.orm.public.KycSubmission.create({
      userId,
      whatsappNumber,
      country,
      state,
      sex,
      dateOfBirth,
      status: "PENDING",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your KYC information has been submitted for review.",
        submission,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("KYC POST error:", error);

    return NextResponse.json(
      { error: "Unable to submit your KYC information. Please try again." },
      { status: 500 }
    );
  }
}
