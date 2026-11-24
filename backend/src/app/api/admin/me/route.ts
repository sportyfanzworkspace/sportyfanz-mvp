
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";

export async function GET() {
  try {
    const result = await requireAdmin();

    if (!result.authorized) {
      return result.response;
    }

    return NextResponse.json({
      success: true,
      admin: result.user,
    });
  } catch (error) {
    console.error("Admin authentication check failed:", error);

    return NextResponse.json(
      { error: "Unable to verify Admin access." },
      { status: 500 }
    );
  }
}
