
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import { lockReward } from "@/lib/accounting/lock-reward";
import { nextRewardUpdatedAt } from "@/lib/accounting/reward-version";

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

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id > 2147483647
    ) {
      return NextResponse.json(
        { error: "Invalid reward ID." },
        { status: 400 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const expectedUpdatedAt = body.expectedUpdatedAt;
    const expectedStock = body.expectedStock;
    const expectedStatus = body.expectedStatus;

    if (
      typeof expectedUpdatedAt !== "string" ||
      !Number.isFinite(
        new Date(expectedUpdatedAt).getTime()
      ) ||
      !(
        expectedStock === null ||
        (
          typeof expectedStock === "number" &&
          Number.isSafeInteger(expectedStock) &&
          expectedStock >= 0 &&
          expectedStock <= 2147483647
        )
      ) ||
      !REWARD_STATUSES.includes(expectedStatus)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid reward snapshot is required. Refresh the page and reopen the reward.",
        },
        { status: 409 }
      );
    }

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

      if (
        !Number.isSafeInteger(pointsCost) ||
        pointsCost < 1 ||
        pointsCost > 2147483647
      ) {
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
        (
          !Number.isSafeInteger(stock) ||
          stock < 0 ||
          stock > 2147483647
        )
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

    const reward = await db.transaction(async (tx) => {
      const existing = await lockReward(tx, id);

      if (!existing) {
        throw new Error("REWARD_NOT_FOUND");
      }

      // Compare the original snapshot only after acquiring
      // the inventory lock.
      if (
        existing.updatedAt !== expectedUpdatedAt ||
        existing.stock !== expectedStock ||
        existing.status !== expectedStatus
      ) {
        throw new Error("REWARD_EDIT_CONFLICT");
      }

      const nextStock =
        data.stock === undefined
          ? existing.stock
          : data.stock;

      const nextStatus =
        data.status === undefined
          ? existing.status
          : data.status;

      if (nextStock === 0 && nextStatus === "ACTIVE") {
        data.status = "SOLD_OUT";
      }

      // Advance the record version even for metadata-only edits.
      data.updatedAt = nextRewardUpdatedAt(
        existing.updatedAt
      );

      const updated = await tx.orm.public.Reward
        .where({ id })
        .update(data);

      if (!updated) {
        throw new Error("REWARD_EDIT_CONFLICT");
      }

      return updated;
    });

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "REWARD_NOT_FOUND") {
      return NextResponse.json(
        { error: "Reward not found." },
        { status: 404 }
      );
    }

    if (message === "REWARD_EDIT_CONFLICT") {
      return NextResponse.json(
        {
          error:
            "This reward has changed since you opened it. Reopen the reward and review its latest details before saving.",
        },
        { status: 409 }
      );
    }

    console.error("Admin reward update failed:", error);
    return NextResponse.json(
      { error: "Unable to update this reward." },
      { status: 500 }
    );
  }
}
