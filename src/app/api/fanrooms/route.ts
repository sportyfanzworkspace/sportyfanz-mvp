import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    let profile: {
      fanRoomsJoined: number;
    } | null = null;

    let joinedRoomIds = new Set<number>();

    if (userId) {
      const user = await db.orm.public.User
        .where({ id: userId })
        .first();

      if (!user || user.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Your account is not active." },
          { status: 403 }
        );
      }

      const fanProfile = await db.orm.public.FanProfile
        .where({ userId })
        .first();

      if (!fanProfile) {
        return NextResponse.json(
          { error: "Fan profile not found." },
          { status: 404 }
        );
      }

      profile = {
        fanRoomsJoined: fanProfile.fanRoomsJoined,
      };

      const memberships = await db.orm.public.FanRoomMember
        .where({ userId })
        .all();

      joinedRoomIds = new Set(
        memberships
          .filter((membership) => membership.leftAt === null)
          .map((membership) => membership.fanRoomId)
      );
    }

    const rooms = await db.orm.public.FanRoom
      .where({ status: "ACTIVE" })
      .all();

    const roomMessages = await Promise.all(
      rooms.map(async (room) => {
        const messages = await db.orm.public.FanRoomMessage
          .where({ fanRoomId: room.id, isDeleted: false })
          .limit(50)
          .all();

        const visibleMessages = messages.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

        const formattedMessages = await Promise.all(
          visibleMessages.map(async (message) => {
            if (message.userId === null) {
              return {
                id: message.id,
                message: message.message,
                createdAt: message.createdAt,
                userId: null,
                username: message.guestName ?? "Guest",
                avatarUrl: null,
                isGuest: true,
                isEdited: message.isEdited,
              };
            }

            const messageUser = await db.orm.public.User
              .where({ id: message.userId })
              .first();

            const messageProfile = await db.orm.public.FanProfile
              .where({ userId: message.userId })
              .first();

            return {
              id: message.id,
              message: message.message,
              createdAt: message.createdAt,
              userId: message.userId,
              username:
                messageUser?.username ??
                messageProfile?.displayName ??
                messageUser?.name ??
                "Fan",
              avatarUrl: messageProfile?.avatarUrl ?? null,
              isGuest: false,
              isEdited: message.isEdited,
            };
          })
        );

        return {
          ...room,
          isJoined: userId
            ? joinedRoomIds.has(room.id)
            : false,
          messages: formattedMessages,
        };
      })
    );

    return NextResponse.json({
      success: true,
      isAuthenticated: Boolean(userId),
      rooms: roomMessages,
      profile,
    });
  } catch (error) {
    console.error("GET /api/fanrooms error:", error);

    return NextResponse.json(
      { error: "Failed to load Fan Rooms." },
      { status: 500 }
    );
  }
}