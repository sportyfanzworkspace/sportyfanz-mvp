import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  FANROOM_GUEST_COOKIE,
  createFanRoomGuestToken,
  fanRoomGuestCookieOptions,
  isValidFanRoomGuestToken,
  hashFanRoomGuestToken,
} from "@/lib/fanroom-guest-security";
import {
  checkFanRoomRateLimit,
} from "@/lib/fanroom-rate-limit";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    const allowedOrigins = new Set([
      "https://sportyfanz.com",
      "https://www.sportyfanz.com",
      ...(process.env.NODE_ENV !== "production"
        ? ["http://localhost:3000", "http://127.0.0.1:3000"]
        : []),
      ...(process.env.CORS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ]);

    if (!origin || !allowedOrigins.has(origin)) {
      return NextResponse.json(
        { error: "Request origin is not allowed." },
        { status: 403 }
      );
    }

    const userId = await getCurrentUserId();
    const body = await request.json().catch(() => null);

    const roomId = body?.roomId;
    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      return NextResponse.json(
        { error: "A valid roomId is required." },
        { status: 400 }
      );
    }

    if (!message || message.length > 1000) {
      return NextResponse.json(
        { error: "Messages must contain 1–1000 characters." },
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

    let username = "";
    let avatarUrl: string | null = null;
    let guestId: string | null = null;
    let guestName: string | null = null;

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

      const profile = await db.orm.public.FanProfile
        .where({ userId })
        .first();

      username =
        user.username ??
        profile?.displayName ??
        user.name ??
        "Fan";

      avatarUrl = profile?.avatarUrl ?? null;
    } else {
      guestId =
        typeof body?.guestId === "string"
          ? body.guestId.trim()
          : "";

      guestName =
        typeof body?.guestName === "string"
          ? body.guestName.trim()
          : "";

      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guestId) ||
        !/^Fan[0-9]{4,8}$/.test(guestName)
      ) {
        return NextResponse.json(
          { error: "A valid guest identity is required." },
          { status: 400 }
        );
      }

      username = guestName;
    }

    const existingGuestToken = !userId
      ? request.cookies.get(FANROOM_GUEST_COOKIE)?.value
      : undefined;

    const guestToken = !userId
      ? isValidFanRoomGuestToken(existingGuestToken)
        ? existingGuestToken
        : createFanRoomGuestToken()
      : null;

    const senderIdentifier = userId
      ? `user:${userId}`
      : `guest:${hashFanRoomGuestToken(guestToken!)}`;

    function messageResponse(
      payload: Record<string, unknown>,
      status: number
    ) {
      const response = NextResponse.json(payload, { status });

      if (!userId && guestToken) {
        response.cookies.set(
          FANROOM_GUEST_COOKIE,
          guestToken,
          fanRoomGuestCookieOptions()
        );
      }

      return response;
    }

    const rateLimit = await checkFanRoomRateLimit(
      senderIdentifier
    );

    if (!rateLimit.allowed) {
      const response = messageResponse(
        {
          error: `Please wait ${rateLimit.retryAfterSeconds} seconds before sending another message.`,
        },
        429
      );

      response.headers.set(
        "Retry-After",
        String(rateLimit.retryAfterSeconds)
      );

      return response;
    }

    const created = await db.orm.public.FanRoomMessage.create({
      fanRoomId: roomId,
      userId: userId ?? null,
      guestId,
      guestName,
      message,
      replyToId: null,
      isEdited: false,
      isDeleted: false,
    });

    return messageResponse(
      {
        success: true,
        message: {
          id: created.id,
          roomId: created.fanRoomId,
          userId: created.userId,
          username,
          avatarUrl,
          isGuest: !userId,
          message: created.message,
          createdAt: created.createdAt,
          isEdited: created.isEdited,
        },
      },
      201
    );
  } catch (error) {
    console.error("POST /api/fanrooms/messages error:", error);

    return NextResponse.json(
      { error: "Failed to send your message." },
      { status: 500 }
    );
  }
}
