import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { user: null },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User.first({
      id: userId,
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { user: null },
        { status: 401 }
      );
    }

    const profile =
      await db.orm.public.FanProfile.first({
        userId,
      });

    if (!profile) {
      return NextResponse.json(
        { user: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,

        fanLevel: profile.fanLevel,

        totalPoints: profile.totalPoints,
        currentPoints: profile.currentPoints,

        matchesWatched: profile.matchesWatched,
        challengesCompleted:
          profile.challengesCompleted,

        fanRoomsJoined:
          profile.fanRoomsJoined,

        avatarUrl:
          profile.avatarUrl ?? null,
      },
    });
  } catch (error) {
    console.error("Profile API error:", error);

    return NextResponse.json(
      {
        user: null,
        error: "Unable to load profile.",
      },
      { status: 500 }
    );
  }
}


const APPROVED_AVATARS = new Set([
  "/avatars/fan-1.svg",
  "/avatars/fan-2.svg",
  "/avatars/fan-3.svg",
  "/avatars/fan-4.svg",
  "/avatars/fan-5.svg",
  "/avatars/fan-6.svg",
]);

export async function PATCH(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User.first({
      id: userId,
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is unavailable." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const avatarUrl = body.avatarUrl;

    if (
      typeof avatarUrl !== "string" ||
      !APPROVED_AVATARS.has(avatarUrl)
    ) {
      return NextResponse.json(
        { error: "Please select an approved SportyFanz avatar." },
        { status: 400 }
      );
    }

    const profile = await db.orm.public.FanProfile
      .where({ userId })
      .first();

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found." },
        { status: 404 }
      );
    }

    await db.orm.public.FanProfile
      .where({ userId })
      .update({ avatarUrl });

    return NextResponse.json({
      success: true,
      avatarUrl,
    });
  } catch (error) {
    console.error("Avatar update error:", error);

    return NextResponse.json(
      { error: "Unable to update your avatar." },
      { status: 500 }
    );
  }
}
