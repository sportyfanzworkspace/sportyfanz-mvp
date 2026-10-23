import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("fans:support");

    if (!auth.authorized) {
      return auth.response;
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Invalid fan account ID." },
        { status: 400 }
      );
    }

    let body: { status?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "A valid JSON request body is required." },
        { status: 400 }
      );
    }

    const status = body.status;

    if (status !== "ACTIVE" && status !== "SUSPENDED") {
      return NextResponse.json(
        { error: "Status must be ACTIVE or SUSPENDED." },
        { status: 400 }
      );
    }

    const fan = await db.orm.public.User.first({ id });

    // Never allow this endpoint to modify staff/admin accounts.
    if (!fan || fan.role !== "USER" || fan.status === "DELETED") {
      return NextResponse.json(
        { error: "Fan account not found or cannot be modified." },
        { status: 404 }
      );
    }

    if (fan.status === status) {
      return NextResponse.json({
        success: true,
        message: `Fan account is already ${status.toLowerCase()}.`,
        fan: {
          id: fan.id,
          status: fan.status,
        },
      });
    }

    await db.orm.public.User.where({ id }).update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message:
        status === "SUSPENDED"
          ? "Fan account suspended successfully."
          : "Fan account reactivated successfully.",
      fan: {
        id: fan.id,
        status,
      },
    });
  } catch (error) {
    console.error("Admin fan status update failed:", error);

    return NextResponse.json(
      { error: "Unable to update the fan account." },
      { status: 500 }
    );
  }
}
