import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getActiveUserId() {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  const user = await db.orm.public.User.first({
    id: userId,
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return userId;
}

// GET: list active sports and the user's saved selections
export async function GET() {
  try {
    const userId = await getActiveUserId();

    if (!userId) {
      return NextResponse.json(
        { message: "Please log in." },
        { status: 401 }
      );
    }

    const [allSports, allFollows] = await Promise.all([
      db.orm.public.Sport.all(),
      db.orm.public.UserSportFollow.all(),
    ]);

    const sports = allSports
      .filter((sport) => sport.isActive)
      .map((sport) => ({
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
      }));

    const followedSportIds = allFollows
      .filter((follow) => follow.userId === userId)
      .map((follow) => follow.sportId);

    return NextResponse.json({
      success: true,
      sports,
      followedSportIds,
    });
  } catch (error) {
    console.error("Sports GET error:", error);

    return NextResponse.json(
      { message: "Unable to load sports." },
      { status: 500 }
    );
  }
}

// POST: add selected sports to the user's follows
export async function POST(request: Request) {
  try {
    const userId = await getActiveUserId();

    if (!userId) {
      return NextResponse.json(
        { message: "Please log in." },
        { status: 401 }
      );
    }

  const body: unknown = await request.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("sportIds" in body) ||
    !Array.isArray(body.sportIds) ||
    !body.sportIds.every(
      (id: unknown) => typeof id === "number"
    )
  ) {
    return NextResponse.json(
     { message: "Please provide a list of numeric sport IDs." },
     { status: 400 }
   );
 }

const sportIds: number[] = [...new Set(body.sportIds)];

    if (sportIds.length === 0) {
      return NextResponse.json(
        { message: "Select at least one sport." },
        { status: 400 }
      );
    }

    const allSports = await db.orm.public.Sport.all();

    const activeSportIds = new Set(
      allSports
        .filter((sport) => sport.isActive)
        .map((sport) => sport.id)
    );

    const invalidSport = sportIds.some(
      (id) => !activeSportIds.has(id)
    );

    if (invalidSport) {
      return NextResponse.json(
        { message: "One or more selected sports are unavailable." },
        { status: 400 }
      );
    }

    const existingFollows =
      await db.orm.public.UserSportFollow.all();

    const existingSportIds = new Set(
      existingFollows
        .filter((follow) => follow.userId === userId)
        .map((follow) => follow.sportId)
    );

    const newSportIds = sportIds.filter(
      (id) => !existingSportIds.has(id)
    );

    await db.transaction(async (tx) => {
      for (const sportId of newSportIds) {
        await tx.orm.public.UserSportFollow.create({
          userId,
          sportId,
        });
      }
    });

    return NextResponse.json({
      success: true,
      followedSportIds: [...existingSportIds, ...newSportIds],
    });
  } catch (error) {
    console.error("Sports POST error:", error);

    return NextResponse.json(
      { message: "Unable to save sports preferences." },
      { status: 500 }
    );
  }
}