import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to view Top Fans." },
        { status: 401 }
      );
    }

    const currentUser = await db.orm.public.User
      .where({ id: userId })
      .first();

    if (!currentUser || currentUser.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    const [users, profiles] = await Promise.all([
      db.orm.public.User.select(
        "id",
        "username",
        "name",
        "role",
        "status"
      ).all(),

      db.orm.public.FanProfile.select(
        "userId",
        "displayName",
        "avatarUrl",
        "totalPoints",
        "fanLevel"
      ).all(),
    ]);

    const profileByUserId = new Map(
      profiles.map((profile) => [profile.userId, profile])
    );

    const fans = users
      .filter((user) => user.role === "USER" && user.status === "ACTIVE")
      .map((user) => {
        const profile = profileByUserId.get(user.id);

        return {
          id: user.id,
          name:
            profile?.displayName?.trim() ||
            user.username ||
            user.name ||
            "Fan",
          username: user.username,
          avatarUrl: profile?.avatarUrl ?? null,
          totalPoints: profile?.totalPoints ?? 0,
          fanLevel: profile?.fanLevel ?? "NEW_FAN",
        };
      })
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 5)
      .map((fan, index) => ({
        ...fan,
        rank: index + 1,
      }));

    return NextResponse.json({ success: true, fans });
  } catch (error) {
    console.error("GET /api/fanrooms/top-fans error:", error);

    return NextResponse.json(
      { error: "Failed to load Top Fans." },
      { status: 500 }
    );
  }
}
