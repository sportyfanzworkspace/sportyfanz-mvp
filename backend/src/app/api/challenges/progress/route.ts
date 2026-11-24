
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";

export async function POST() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Please log in to continue." },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Challenge progress is updated automatically when you complete a qualifying activity.",
    },
    { status: 403 }
  );
}
