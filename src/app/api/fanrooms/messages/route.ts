
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to send messages." },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User
      .where({ id: userId })
      .first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const roomId = Number(body?.roomId);
    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      return NextResponse.json(
        { error: "A valid roomId is required." },
        { status: 400 }
      );
    }

    if (!message || message.length > 1000) {
      return NextResponse.json(
        { error: "Messages must contain 1–1000 characters." },
        { status: 400 }
      );
    }

    const room = await db.orm.public.FanRoom
      .where({ id: roomId })
      .first();

    if (!room || room.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This Fan Room is not available." },
        { status: 404 }
      );
    }

    const membership = await db.orm.public.FanRoomMember
      .where({ fanRoomId: roomId, userId })
      .first();

    if (!membership || membership.leftAt !== null) {
      return NextResponse.json(
        { error: "Join this Fan Room before sending messages." },
        { status: 403 }
      );
    }

    const created = await db.orm.public.FanRoomMessage.create({
      fanRoomId: roomId,
      userId,
      message,
      replyToId: null,
      isEdited: false,
      isDeleted: false,
    });

    const profile = await db.orm.public.FanProfile
      .where({ userId })
      .first();

    return NextResponse.json(
      {
        success: true,
        message: {
          id: created.id,
          roomId: created.fanRoomId,
          userId: created.userId,
          username:
            user.username ??
            profile?.displayName ??
            user.name ??
            "Fan",
          avatarUrl: profile?.avatarUrl ?? null,
          message: created.message,
          createdAt: created.createdAt,
          isEdited: created.isEdited,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/fanrooms/messages error:", error);

    return NextResponse.json(
      { error: "Failed to send your message." },
      { status: 500 }
    );
  }
}
