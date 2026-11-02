
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPORT_HOSTS: Record<string, {
  baseUrl: string;
  endpoint: string;
}> = {
  football: {
    baseUrl: "https://v3.football.api-sports.io",
    endpoint: "/fixtures",
  },
  basketball: {
    baseUrl: "https://v1.basketball.api-sports.io",
    endpoint: "/games",
  },
  baseball: {
    baseUrl: "https://v1.baseball.api-sports.io",
    endpoint: "/games",
  },
  rugby: {
    baseUrl: "https://v1.rugby.api-sports.io",
    endpoint: "/games",
  },
  volleyball: {
    baseUrl: "https://v1.volleyball.api-sports.io",
    endpoint: "/games",
  },
};

type ProviderFixture = {
  id?: number;
  fixture?: {
    id?: number;
  };
  league?: {
    name?: string;
    country?: string;
  };
  teams?: {
    home?: { name?: string };
    away?: { name?: string };
  };
};

function hasProviderErrors(errors: unknown): boolean {
  if (Array.isArray(errors)) return errors.length > 0;

  if (errors && typeof errors === "object") {
    return Object.keys(errors).length > 0;
  }

  return false;
}

async function findExistingRoom(sport: string, fixtureId: number) {
  // Preserve existing football rooms linked through imported matches.
  if (sport === "football") {
    const match = await db.orm.public.Match
      .where({ apiFootballFixtureId: fixtureId })
      .first();

    if (match) {
      const linkedRoom = await db.orm.public.FanRoom
        .where({ matchId: match.id })
        .first();

      if (linkedRoom) return linkedRoom;
    }

    // Backward compatibility with rooms created before sport-aware IDs.
    const legacyRoom = await db.orm.public.FanRoom
      .where({ apiFootballFixtureId: fixtureId })
      .first();

    if (legacyRoom) return legacyRoom;
  }

  return db.orm.public.FanRoom
    .where({
      sport,
      providerFixtureId: fixtureId,
    })
    .first();
}

async function createMatchRoom(sport: string, fixtureId: number) {
  const config = SPORT_HOSTS[sport];
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!config || !apiKey) {
    throw new Error("Sports data is temporarily unavailable.");
  }

  const url = new URL(`${config.baseUrl}${config.endpoint}`);
  url.searchParams.set("id", String(fixtureId));

  const response = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Unable to verify this ${sport} fixture.`);
  }

  const payload = await response.json();

  if (
    hasProviderErrors(payload.errors) ||
    !Array.isArray(payload.response)
  ) {
    throw new Error(`${sport} fixture data is temporarily unavailable.`);
  }

  const fixture = payload.response[0] as ProviderFixture | undefined;

  const verifiedId =
    sport === "football"
      ? fixture?.fixture?.id
      : fixture?.id;

  if (
    !fixture ||
    verifiedId !== fixtureId ||
    !fixture.teams?.home?.name ||
    !fixture.teams?.away?.name
  ) {
    throw new Error(`The requested ${sport} fixture could not be verified.`);
  }

  const homeTeam = fixture.teams.home.name.trim();
  const awayTeam = fixture.teams.away.name.trim();
  const competition = fixture.league?.name?.trim();

  const name = `${homeTeam} vs ${awayTeam} Fan Room`.slice(0, 100);

  const description = [
    `Discuss ${homeTeam} vs ${awayTeam} with fellow fans.`,
    competition ? `Competition: ${competition}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return db.orm.public.FanRoom.create({
    name,
    slug: sport === "football"
      ? `match-${fixtureId}-fan-room`
      : `${sport}-match-${fixtureId}-fan-room`,
    description,
    status: "ACTIVE",
    matchId: null,
    apiFootballFixtureId: sport === "football" ? fixtureId : null,
    sport,
    providerFixtureId: fixtureId,
  });
}

export async function GET(
  request: Request,
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
    const sport = new URL(request.url).searchParams
      .get("sport")?.toLowerCase() ?? "football";

    if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
      return NextResponse.json(
        { error: "A valid fixture ID is required." },
        { status: 400 }
      );
    }

    if (!SPORT_HOSTS[sport]) {
      return NextResponse.json(
        { error: "This sport is not supported for match Fan Rooms." },
        { status: 400 }
      );
    }

    let room = await findExistingRoom(sport, fixtureId);

    if (!room) {
      try {
        room = await createMatchRoom(sport, fixtureId);
      } catch (creationError) {
        // Recover if another request created the same room concurrently.
        room = await findExistingRoom(sport, fixtureId);

        if (!room) throw creationError;
      }
    }

    if (room.status !== "ACTIVE") {
      return NextResponse.json({
        success: true,
        room: null,
        unavailable: true,
        roomStatus: room.status,
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
        hasMembershipRecord: membership != null,
        messages: formattedMessages,
      },
      profile: {
        fanRoomsJoined: profile.fanRoomsJoined,
      },
    });
  } catch (error) {
    console.error("GET /api/fanrooms/match/[fixtureId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load the match Fan Room.",
      },
      { status: 500 }
    );
  }
}
