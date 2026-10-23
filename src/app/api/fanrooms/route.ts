
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to access Fan Rooms." },
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

    const profile = await db.orm.public.FanProfile
      .where({ userId })
      .first();

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found." },
        { status: 404 }
      );
    }

    const rooms = await db.orm.public.FanRoom
      .where({ status: "ACTIVE" })
      .all();

    const memberships = await db.orm.public.FanRoomMember
      .where({ userId })
      .all();

    const activeMemberships = memberships.filter(
      (membership) => membership.leftAt === null
    );

    const activeRoomIds = new Set(
      rooms.map((room) => room.id)
    );

    const joinedRoomIds = new Set(
      activeMemberships
        .filter((membership) =>
          activeRoomIds.has(membership.fanRoomId)
        )
        .map((membership) => membership.fanRoomId)
    );

    const roomMessages = await Promise.all(
      rooms.map(async (room) => {
        const messages = await db.orm.public.FanRoomMessage
          .where({ fanRoomId: room.id, isDeleted: false })
          .limit(50)
          .all();

        const visibleMessages = messages
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()
          );

        const formattedMessages = await Promise.all(
          visibleMessages.map(async (message) => {
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
              isEdited: message.isEdited,
            };
          })
        );

        return {
          ...room,
          isJoined: joinedRoomIds.has(room.id),
          messages: formattedMessages,
        };
      })
    );

    return NextResponse.json({
      success: true,
      rooms: roomMessages,
      profile: {
        fanRoomsJoined: profile.fanRoomsJoined,
      },
    });
  } catch (error) {
    console.error("GET /api/fanrooms error:", error);

    return NextResponse.json(
      { error: "Failed to load Fan Rooms." },
      { status: 500 }
    );
  }
}
