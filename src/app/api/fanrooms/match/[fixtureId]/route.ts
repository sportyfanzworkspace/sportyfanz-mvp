import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to access the Fan Room." },
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

    const { fixtureId: rawFixtureId } = await params;
    const fixtureId = Number(rawFixtureId);

    if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
      return NextResponse.json(
        { error: "A valid fixture ID is required." },
        { status: 400 }
      );
    }

    // Resolve the external API-Football fixture to our internal match.
    const match = await db.orm.public.Match
      .where({ apiFootballFixtureId: fixtureId })
      .first();

    if (!match || match.matchDataSource !== "API_FOOTBALL") {
      return NextResponse.json({
        success: true,
        room: null,
      });
    }

    const room = await db.orm.public.FanRoom
      .where({ matchId: match.id, status: "ACTIVE" })
      .first();

    if (!room) {
      return NextResponse.json({
        success: true,
        room: null,
      });
    }

    const membership = await db.orm.public.FanRoomMember
      .where({ fanRoomId: room.id, userId })
      .first();

    const isJoined =
      membership != null && membership.leftAt === null;

    let formattedMessages: {
      id: number;
      message: string;
      createdAt: string;
      userId: number;
      username: string;
      avatarUrl: string | null;
      isEdited: boolean;
    }[] = [];

    if (isJoined) {
      const messages = await db.orm.public.FanRoomMessage
        .where({ fanRoomId: room.id, isDeleted: false })
        .limit(50)
        .all();

      const visibleMessages = messages.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      );

      formattedMessages = await Promise.all(
        visibleMessages.map(async (message) => {
          const [messageUser, messageProfile] = await Promise.all([
            db.orm.public.User
              .where({ id: message.userId })
              .first(),
            db.orm.public.FanProfile
              .where({ userId: message.userId })
              .first(),
          ]);

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
    }

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        slug: room.slug,
        description: room.description,
        memberCount: room.memberCount,
        isJoined,
        messages: formattedMessages,
      },
      profile: {
        fanRoomsJoined: profile.fanRoomsJoined,
      },
    });
  } catch (error) {
    console.error("GET /api/fanrooms/match/[fixtureId] error:", error);

    return NextResponse.json(
      { error: "Failed to load the match Fan Room." },
      { status: 500 }
    );
  }
}
