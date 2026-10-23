
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

const ROOM_STATUSES = ["ACTIVE", "CLOSED", "ARCHIVED"] as const;

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
    const auth = await requirePermission("fanrooms:manage");
    if (!auth.authorized) return auth.response;

    const [rooms, members, messages] = await Promise.all([
      db.orm.public.FanRoom.all(),
      db.orm.public.FanRoomMember.all(),
      db.orm.public.FanRoomMessage.all(),
    ]);

    const items = rooms
      .map((room) => ({
        ...room,
        memberCount: members.filter(
          (member) =>
            member.fanRoomId === room.id &&
            member.leftAt === null
        ).length,
        messageCount: messages.filter(
          (message) =>
            message.fanRoomId === room.id &&
            !message.isDeleted
        ).length,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    return NextResponse.json({
      success: true,
      rooms: items,
      summary: {
        totalRooms: items.length,
        activeRooms: items.filter(
          (room) => room.status === "ACTIVE"
        ).length,
        closedRooms: items.filter(
          (room) => room.status === "CLOSED"
        ).length,
        totalMembers: members.filter(
          (member) => member.leftAt === null
        ).length,
      },
    });
  } catch (error) {
    console.error("Admin Fan Rooms list failed:", error);
    return NextResponse.json(
      { error: "Unable to load Fan Room management data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("fanrooms:manage");
    if (!auth.authorized) return auth.response;

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";
    const coverImageUrl =
      typeof body.coverImageUrl === "string"
        ? body.coverImageUrl.trim()
        : "";
    const requestedStatus = body.status ?? "ACTIVE";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Room name must be between 2 and 100 characters." },
        { status: 400 }
      );
    }

    if (description.length > 1000) {
      return NextResponse.json(
        { error: "Description cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    if (
      coverImageUrl &&
      !/^https?:\/\/\S+$/i.test(coverImageUrl)
    ) {
      return NextResponse.json(
        { error: "Cover image URL must begin with http:// or https://." },
        { status: 400 }
      );
    }

    if (
      requestedStatus !== "ACTIVE" &&
      requestedStatus !== "CLOSED"
    ) {
      return NextResponse.json(
        { error: "A new room must be ACTIVE or CLOSED." },
        { status: 400 }
      );
    }

    const baseSlug = makeSlug(name);

    if (!baseSlug) {
      return NextResponse.json(
        { error: "Room name cannot produce a valid URL slug." },
        { status: 400 }
      );
    }

    const existing = await db.orm.public.FanRoom.first({
      slug: baseSlug,
    });

    const slug = existing
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    const room = await db.orm.public.FanRoom.create({
      name,
      slug,
      description: description || null,
      coverImageUrl: coverImageUrl || null,
      status: requestedStatus,
    });

    return NextResponse.json(
      { success: true, room },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin Fan Room creation failed:", error);
    return NextResponse.json(
      { error: "Unable to create this Fan Room." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requirePermission("fanrooms:manage");
    if (!auth.authorized) return auth.response;

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const id = Number(body.id);
    const status = body.status;

   if (
     typeof status !== "string" ||
     !ROOM_STATUSES.includes(
      status as (typeof ROOM_STATUSES)[number]
    )
   ) {
   return NextResponse.json(
    { error: "Select a valid room status." },
    { status: 400 }
  );
}

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "A valid room ID is required." },
        { status: 400 }
      );
    }

    
    const existing = await db.orm.public.FanRoom
      .where({ id })
      .first();

    if (!existing) {
      return NextResponse.json(
        { error: "Fan Room not found." },
        { status: 404 }
      );
    }

    const room = await db.orm.public.FanRoom
      .where({ id })
      .update({
        status: status as (typeof ROOM_STATUSES)[number],
      });

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("Admin Fan Room status update failed:", error);
    return NextResponse.json(
      { error: "Unable to update this Fan Room." },
      { status: 500 }
    );
  }
}
