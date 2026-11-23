import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          notifications: [],
          unreadCount: 0,
          isGuest: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const user = await db.orm.public.User
      .where({ id: userId })
      .first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is not active." },
        { status: 403 }
      );
    }

    const notifications =
      await db.orm.public.Notification
        .where({ userId })
        .all();

    const sortedNotifications = [...notifications]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    const unreadCount = notifications.filter(
      (notification) => !notification.isRead
    ).length;

    return NextResponse.json(
      {
        notifications: sortedNotifications.slice(0, 50),
        unreadCount,
        isGuest: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Notification retrieval failed:",
      error
    );

    return NextResponse.json(
      { error: "Unable to load notifications." },
      { status: 500 }
    );
  }
}
