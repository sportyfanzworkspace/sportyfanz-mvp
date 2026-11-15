import { NextResponse } from "next/server";
import {
  createSession,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const identifier =
      typeof body.identifier === "string"
      ? body.identifier.trim().toLowerCase()
      : "";


    const password =
      typeof body.password === "string"
        ? body.password
        : "";
      if (!identifier || !password) {
        return NextResponse.json(
       {
        error: "Username or email and password are required.",
       },
      { status: 400 }
     );
    }

   let user = await db.orm.public.User.first({
    email: identifier,
   });

    if (!user) {
      user = await db.orm.public.User.first({
      username: identifier,
     });
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "This account is not currently active.",
        },
        { status: 403 }
      );
    }

    const passwordValid =
      await verifyPassword(
        password,
        user.passwordHash
      );

    if (!passwordValid) {
      return NextResponse.json(
        {
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    // New registrations require email verification before login.
    // Existing accounts must be backfilled as verified before
    // enabling this check in production.
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: "Please verify your email address before logging in.",
          requiresEmailVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    await db.orm.public.User
     .where({ id: user.id })
     .update({
     lastLoginAt: new Date().toISOString(),
    });

    await createSession(user.id);

    const profile =
      await db.orm.public.FanProfile.first({
        userId: user.id,
      });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        fanLevel: profile?.fanLevel ?? "NEW_FAN",
        points: profile?.currentPoints ?? 0,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        error: "Unable to sign you in.",
      },
      { status: 500 }
    );
  }
}