
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requirePermission("predictions:manage");

    if (auth instanceof Response) {
      return auth;
    }

    const [sports, teams] = await Promise.all([
      db.orm.public.Sport.all(),
      db.orm.public.Team.all(),
    ]);

    return NextResponse.json({
      success: true,
      sports: sports.map((sport) => ({
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
        isActive: sport.isActive,
      })),
      teams: teams.map((team) => ({
        id: team.id,
        sportId: team.sportId,
        name: team.name,
        shortName: team.shortName,
        slug: team.slug,
        isActive: team.isActive,
      })),
    });
  } catch (error) {
    console.error("Fixture catalog diagnostic failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load the sport and team catalog." },
      { status: 500 }
    );
  }
}
