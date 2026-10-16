
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

const REWARD_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "SOLD_OUT",
  "ARCHIVED",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("rewards:manage");
    if (!auth.authorized) return auth.response;

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Invalid reward ID." },
        { status: 400 }
      );
    }

    const existing = await db.orm.public.Reward
      .where({ id })
      .first();

    if (!existing) {
      return NextResponse.json(
        { error: "Reward not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        body.name.trim().length < 2 ||
        body.name.trim().length > 150
      ) {
        return NextResponse.json(
          { error: "Reward name must be between 2 and 150 characters." },
          { status: 400 }
        );
      }
      data.name = body.name.trim();
    }

    if (body.description !== undefined) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        return NextResponse.json(
          { error: "Description must be text." },
          { status: 400 }
        );
      }
      data.description =
        typeof body.description === "string" &&
        body.description.trim()
          ? body.description.trim()
          : null;
    }

    if (body.imageUrl !== undefined) {
      if (
        body.imageUrl !== null &&
        typeof body.imageUrl !== "string"
      ) {
        return NextResponse.json(
          { error: "Image URL must be text." },
          { status: 400 }
        );
      }

      const imageUrl =
        typeof body.imageUrl === "string"
          ? body.imageUrl.trim()
          : "";

      if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) {
        return NextResponse.json(
          { error: "Image URL must begin with http:// or https://." },
          { status: 400 }
        );
      }

      data.imageUrl = imageUrl || null;
    }

    if (body.category !== undefined) {
      if (
        body.category !== null &&
        typeof body.category !== "string"
      ) {
        return NextResponse.json(
          { error: "Category must be text." },
          { status: 400 }
        );
      }

      data.category =
        typeof body.category === "string" &&
        body.category.trim()
          ? body.category.trim()
          : null;
    }

    if (body.pointsCost !== undefined) {
      const pointsCost = Number(body.pointsCost);

      if (!Number.isSafeInteger(pointsCost) || pointsCost < 1) {
        return NextResponse.json(
          { error: "Points cost must be a positive whole number." },
          { status: 400 }
        );
      }

      data.pointsCost = pointsCost;
    }

    if (body.stock !== undefined) {
      const stock =
        body.stock === "" || body.stock === null
          ? null
          : Number(body.stock);

      if (
        stock !== null &&
        (!Number.isSafeInteger(stock) || stock < 0)
      ) {
        return NextResponse.json(
          { error: "Stock must be zero or a positive whole number." },
          { status: 400 }
        );
      }

      data.stock = stock;
    }

    if (body.status !== undefined) {
      if (
        !REWARD_STATUSES.includes(
          body.status as (typeof REWARD_STATUSES)[number]
        )
      ) {
        return NextResponse.json(
          { error: "Select a valid reward status." },
          { status: 400 }
        );
      }

      data.status = body.status;
    }

    const reward = await db.orm.public.Reward
      .where({ id })
      .update(data);

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error("Admin reward update failed:", error);
    return NextResponse.json(
      { error: "Unable to update this reward." },
      { status: 500 }
    );
  }
}
