import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          user: null,
        },
        { status: 401 }
      );
    }

    const user =
      await db.orm.public.User.first({
        id: userId,
      });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          user: null,
        },
        { status: 401 }
      );
    }

    const profile =
      await db.orm.public.FanProfile.first({
        userId,
      });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,

        fanLevel:
          profile?.fanLevel ?? "NEW_FAN",

        totalPoints:
          profile?.totalPoints ?? 0,

        currentPoints:
          profile?.currentPoints ?? 0,

        avatarUrl:
          profile?.avatarUrl ?? null,
      },
    });
  } catch (error) {
    console.error("Auth/me error:", error);

    return NextResponse.json(
      {
        user: null,
      },
      { status: 500 }
    );
  }
}