import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  _request: Request,
  context: RouteContext
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in to manage notifications." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const notificationId = Number(id);

    if (
      !Number.isSafeInteger(notificationId) ||
      notificationId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid notification ID." },
        { status: 400 }
      );
    }

    const notification =
      await db.orm.public.Notification
        .where({
          id: notificationId,
          userId,
        })
        .first();

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }

    if (notification.isRead) {
      return NextResponse.json({
        success: true,
        notification,
      });
    }

    const updated =
      await db.orm.public.Notification
        .where({
          id: notificationId,
          userId,
          isRead: false,
        })
        .update({
          isRead: true,
          readAt: new Date().toISOString(),
        });

    return NextResponse.json({
      success: true,
      notification: updated,
    });
  } catch (error) {
    console.error(
      "Mark notification as read failed:",
      error
    );

    return NextResponse.json(
      { error: "Unable to update notification." },
      { status: 500 }
    );
  }
}
