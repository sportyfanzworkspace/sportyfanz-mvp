import { NextResponse } from "next/server";
import { hashPassword, createSession } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const existingEmail = await db.orm.public.User.first({
      email,
    });

    if (existingEmail) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    if (username) {
      const existingUsername =
        await db.orm.public.User.first({
          username,
        });

      if (existingUsername) {
        return NextResponse.json(
          {
            error: "That username is already taken.",
          },
          { status: 409 }
        );
      }
    }

    const passwordHash = await hashPassword(password);

    const result = await db.transaction(async (tx) => {
      const user =
        await tx.orm.public.User.create({
          email,
          username: username || null,
          name: name || null,
          passwordHash,
        });

      const profile =
        await tx.orm.public.FanProfile.create({
          userId: user.id,
          displayName: name || username || null,
          fanLevel: "NEW_FAN",
          totalPoints: 0,
          currentPoints: 0,
          progressionPoints: 0,
          matchesWatched: 0,
          challengesCompleted: 0,
          fanRoomsJoined: 0,
        });

      return {
        user,
        profile,
      };
    });

    await createSession(result.user.id);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          name: result.user.name,
          fanLevel: result.profile.fanLevel,
          points: result.profile.currentPoints,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      {
        error: "Unable to create your account.",
      },
      { status: 500 }
    );
  }
}