import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function PATCH() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in to manage notifications." },
        { status: 401 }
      );
    }

    const notifications =
      await db.orm.public.Notification
        .where({
          userId,
          isRead: false,
        })
        .all();

    const readAt = new Date().toISOString();

    for (const notification of notifications) {
      await db.orm.public.Notification
        .where({
          id: notification.id,
          userId,
          isRead: false,
        })
        .update({
          isRead: true,
          readAt,
        });
    }

    return NextResponse.json({
      success: true,
      updatedCount: notifications.length,
      unreadCount: 0,
    });
  } catch (error) {
    console.error(
      "Mark all notifications as read failed:",
      error
    );

    return NextResponse.json(
      { error: "Unable to mark notifications as read." },
      { status: 500 }
    );
  }
}
