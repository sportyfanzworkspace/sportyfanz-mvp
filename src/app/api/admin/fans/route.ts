
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

const VALID_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;

export async function GET(request: Request) {
  try {
    const auth = await requirePermission("fans:support");

    if (!auth.authorized) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim().toLowerCase();
    const requestedStatus = (searchParams.get("status") ?? "ALL").toUpperCase();
    const requestedLevel = (searchParams.get("level") ?? "ALL").toUpperCase();

    if (
      requestedStatus !== "ALL" &&
      !VALID_STATUSES.includes(requestedStatus as (typeof VALID_STATUSES)[number])
    ) {
      return NextResponse.json(
        { error: "Invalid fan account status." },
        { status: 400 }
      );
    }

    const [users, profiles] = await Promise.all([
      db.orm.public.User.select(
        "id",
        "email",
        "username",
        "name",
        "role",
        "status",
        "createdAt",
        "lastLoginAt"
      ).all(),

      db.orm.public.FanProfile.select(
        "userId",
        "displayName",
        "fanLevel",
        "totalPoints",
        "currentPoints",
        "country",
        "city"
      ).all(),
    ]);

    // Only include ordinary fan accounts, never staff/admin accounts.
    const fans = users.filter((user) => user.role === "USER");
    const profileByUserId = new Map(
      profiles.map((profile) => [profile.userId, profile])
    );

    const summary = {
      total: fans.length,
      active: fans.filter((fan) => fan.status === "ACTIVE").length,
      suspended: fans.filter((fan) => fan.status === "SUSPENDED").length,
      deleted: fans.filter((fan) => fan.status === "DELETED").length,
    };

    const results = fans
      .map((user) => {
        const profile = profileByUserId.get(user.id);

        return {
          id: user.id,
          name: user.name,
          displayName: profile?.displayName ?? null,
          username: user.username,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          fanLevel: profile?.fanLevel ?? "NEW_FAN",
          totalPoints: profile?.totalPoints ?? 0,
          currentPoints: profile?.currentPoints ?? 0,
          country: profile?.country ?? null,
          city: profile?.city ?? null,
        };
      })
      .filter((fan) => {
        const matchesStatus =
          requestedStatus === "ALL" || fan.status === requestedStatus;

        const matchesLevel =
          requestedLevel === "ALL" || fan.fanLevel === requestedLevel;

        const searchableText = [
          fan.name,
          fan.displayName,
          fan.username,
          fan.email,
          fan.country,
          fan.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesQuery =
          !query || searchableText.includes(query);

        return matchesStatus && matchesLevel && matchesQuery;
      })
      .sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      });

    return NextResponse.json({
      success: true,
      summary,
      total: results.length,
      fans: results,
    });
  } catch (error) {
    console.error("Admin fan directory failed:", error);

    return NextResponse.json(
      { error: "Unable to load fan accounts." },
      { status: 500 }
    );
  }
}
