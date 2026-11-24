
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import { getFanLevel } from "@/lib/progression";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// GET: List KYC submissions for authorised reviewers.
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission("kyc:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const requestedStatus =
      request.nextUrl.searchParams.get("status")?.toUpperCase();

    const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];

    if (
      requestedStatus &&
      !allowedStatuses.includes(requestedStatus)
    ) {
      return jsonError(
        "Status must be PENDING, APPROVED, or REJECTED.",
        400
      );
    }

    const submissions =
      await db.orm.public.KycSubmission.all();

    const filtered = submissions
      .filter(
        (submission) =>
          !requestedStatus ||
          submission.status === requestedStatus
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    const submissionsWithUsers = await Promise.all(
      filtered.map(async (submission) => {
        const user = await db.orm.public.User
          .where({ id: submission.userId })
          .first();

        return {
          ...submission,
          user: {
            name: user?.name ?? null,
            username: user?.username ?? null,
          },
        };
      })
    );

    return NextResponse.json(
      {
        submissions: submissionsWithUsers,
        total: submissionsWithUsers.length,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Admin KYC GET error:", error);
    return jsonError("Unable to retrieve KYC submissions.", 500);
  }
}

// POST: Approve or reject a submission.
// Approval and its one-time progression award happen in one transaction.
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("kyc:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid review request.", 400);
    }

    const data = body as Record<string, unknown>;
    const submissionId = data.submissionId;
    const decision =
      typeof data.decision === "string"
        ? data.decision.toUpperCase()
        : "";
    const rejectionReason =
      typeof data.rejectionReason === "string"
        ? data.rejectionReason.trim()
        : "";

    if (
      !Number.isSafeInteger(submissionId) ||
      (submissionId as number) <= 0
    ) {
      return jsonError("A valid submissionId is required.", 400);
    }

    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return jsonError("Decision must be APPROVED or REJECTED.", 400);
    }

    if (decision === "REJECTED" && !rejectionReason) {
      return jsonError(
        "Please provide a reason when rejecting a submission.",
        400
      );
    }

    if (rejectionReason.length > 1000) {
      return jsonError("Rejection reason is too long.", 400);
    }

    const id = submissionId as number;
    const reviewedAt = new Date().toISOString();

    const result = await db.transaction(async (tx) => {
      const submission =
        await tx.orm.public.KycSubmission
          .where({ id })
          .first();

      if (!submission) {
        return {
          error: "KYC submission not found.",
          status: 404,
        } as const;
      }

      if (submission.status !== "PENDING") {
        return {
          error: `This submission has already been ${submission.status.toLowerCase()}.`,
          status: 409,
        } as const;
      }

      if (decision === "REJECTED") {
        const updated =
          await tx.orm.public.KycSubmission
            .where({ id })
            .update({
              status: "REJECTED",
              reviewedByUserId: auth.user.id,
              reviewedAt,
              rejectionReason,
              updatedAt: reviewedAt,
            });

        return {
          success: true,
          decision: "REJECTED",
          submission: updated,
          progressionPointsAwarded: 0,
        } as const;
      }

      const profile =
        await tx.orm.public.FanProfile
          .where({ userId: submission.userId })
          .first();

      if (!profile) {
        throw new Error("Fan profile not found for KYC submission.");
      }

      // The unique [userId, taskKey] constraint prevents a second KYC award.
      const existingAward =
        await tx.orm.public.ProgressionAward
          .where({
            userId: submission.userId,
            taskKey: "KYC_APPROVED",
          })
          .first();

      let progressionPointsAwarded = 0;

      if (!existingAward) {
        const newBalance = profile.progressionPoints + 40;
        const newLevel = getFanLevel(newBalance);

        await tx.orm.public.ProgressionAward.create({
          userId: submission.userId,
          taskKey: "KYC_APPROVED",
          points: 40,
          description: "KYC approved",
        });

        await tx.orm.public.FanProfile
          .where({ userId: submission.userId })
          .update({
            progressionPoints: newBalance,
            fanLevel: newLevel,
            updatedAt: reviewedAt,
          });

        progressionPointsAwarded = 40;
      }

      const updated =
        await tx.orm.public.KycSubmission
          .where({ id })
          .update({
            status: "APPROVED",
            reviewedByUserId: auth.user.id,
            reviewedAt,
            rejectionReason: null,
            updatedAt: reviewedAt,
          });

      return {
        success: true,
        decision: "APPROVED",
        submission: updated,
        progressionPointsAwarded,
      } as const;
    });

    if ("error" in result) {
      return jsonError(result.error, result.status);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin KYC review error:", error);
    return jsonError("Unable to review this KYC submission.", 500);
  }
}
