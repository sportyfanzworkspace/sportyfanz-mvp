
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

const REWARD_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "SOLD_OUT",
  "ARCHIVED",
] as const;

function makeSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  try {
    const auth = await requirePermission("rewards:manage");
    if (!auth.authorized) return auth.response;

    const [rewards, redemptions] = await Promise.all([
      db.orm.public.Reward.all(),
      db.orm.public.RewardRedemption.all(),
    ]);

    return NextResponse.json({
      success: true,
      rewards,
      redemptions,
    });
  } catch (error) {
    console.error("Admin rewards list failed:", error);
    return NextResponse.json(
      { error: "Unable to load rewards management data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("rewards:manage");
    if (!auth.authorized) return auth.response;

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";
    const imageUrl =
      typeof body.imageUrl === "string"
        ? body.imageUrl.trim()
        : "";
    const category =
      typeof body.category === "string"
        ? body.category.trim()
        : "";
    const pointsCost = Number(body.pointsCost);
    const stock =
      body.stock === "" || body.stock === null || body.stock === undefined
        ? null
        : Number(body.stock);
    const status = body.status ?? "ACTIVE";

    if (name.length < 2 || name.length > 150) {
      return NextResponse.json(
        { error: "Reward name must be between 2 and 150 characters." },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(pointsCost) || pointsCost < 1) {
      return NextResponse.json(
        { error: "Points cost must be a positive whole number." },
        { status: 400 }
      );
    }

    if (
      stock !== null &&
      (!Number.isSafeInteger(stock) || stock < 0)
    ) {
      return NextResponse.json(
        { error: "Stock must be zero or a positive whole number." },
        { status: 400 }
      );
    }

    if (
      !REWARD_STATUSES.includes(
        status as (typeof REWARD_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Select a valid reward status." },
        { status: 400 }
      );
    }

    if (
      imageUrl &&
      !/^https?:\/\/\S+$/i.test(imageUrl)
    ) {
      return NextResponse.json(
        { error: "Image URL must begin with http:// or https://." },
        { status: 400 }
      );
    }

    const baseSlug = makeSlug(name);
    if (!baseSlug) {
      return NextResponse.json(
        { error: "The reward name cannot produce a valid URL slug." },
        { status: 400 }
      );
    }

    const existing = await db.orm.public.Reward.first({
      slug: baseSlug,
    });

    const slug = existing
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    const reward = await db.orm.public.Reward.create({
      name,
      slug,
      description: description || null,
      imageUrl: imageUrl || null,
      pointsCost,
      stock,
      status,
      category: category || null,
    });

    return NextResponse.json(
      { success: true, reward },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin reward creation failed:", error);
    return NextResponse.json(
      { error: "Unable to create this reward." },
      { status: 500 }
    );
  }
}
