import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in first." },
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
    const action = body?.action;

    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      !["join", "leave"].includes(action)
    ) {
      return NextResponse.json(
        { error: "A valid roomId and join/leave action are required." },
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

    const profile = await db.orm.public.FanProfile
      .where({ userId })
      .first();

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found." },
        { status: 404 }
      );
    }

    const membership = await db.orm.public.FanRoomMember
      .where({ fanRoomId: roomId, userId })
      .first();

    const isMember = membership != null && membership.leftAt === null;

    if (action === "join" && isMember) {
      return NextResponse.json({
        success: true,
        message: "You have already joined this room.",
        isJoined: true,
      });
    }

    if (action === "leave" && !isMember) {
      return NextResponse.json({
        success: true,
        message: "You have already left this room.",
        isJoined: false,
      });
    }

    await db.transaction(async (tx) => {
      const now = new Date().toISOString();

      if (action === "join") {
        if (membership) {
          await tx.orm.public.FanRoomMember
            .where({ fanRoomId: roomId, userId })
            .update({
              leftAt: null,
              joinedAt: now,
            });
        } else {
          await tx.orm.public.FanRoomMember.create({
            fanRoomId: roomId,
            userId,
            role: "MEMBER",
            joinedAt: now,
            leftAt: null,
          });
        }

        await tx.orm.public.FanRoom
          .where({ id: roomId })
          .update({
            memberCount: room.memberCount + 1,
          });

        await tx.orm.public.FanProfile
          .where({ userId })
          .update({
            fanRoomsJoined: profile.fanRoomsJoined + 1,
          });
      } else {
        await tx.orm.public.FanRoomMember
          .where({ fanRoomId: roomId, userId })
          .update({ leftAt: now });

        await tx.orm.public.FanRoom
          .where({ id: roomId })
          .update({
            memberCount: Math.max(0, room.memberCount - 1),
          });

        await tx.orm.public.FanProfile
          .where({ userId })
          .update({
            fanRoomsJoined: Math.max(0, profile.fanRoomsJoined - 1),
          });
      }
    });

    return NextResponse.json({
      success: true,
      message:
        action === "join"
          ? "You joined the Fan Room."
          : "You left the Fan Room.",
      isJoined: action === "join",
    });
  } catch (error) {
    console.error("POST /api/fanrooms/membership error:", error);

    return NextResponse.json(
      { error: "Failed to update Fan Room membership." },
      { status: 500 }
    );
  }
}