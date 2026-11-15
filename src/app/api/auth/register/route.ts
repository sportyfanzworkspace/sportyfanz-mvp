import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import {
  generateVerificationCode,
  hashVerificationCode,
  VERIFICATION_CODE_TTL_MS,
} from "@/lib/email-verification";
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
     ? body.username.trim().toLowerCase()
     : "";

    const firstName =
      typeof body.firstName === "string"
        ? body.firstName.trim()
        : "";

    const lastName =
      typeof body.lastName === "string"
        ? body.lastName.trim()
        : "";

    const name = [firstName, lastName].filter(Boolean).join(" ");

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

    const whatsappNumber =
      typeof body.whatsappNumber === "string"
        ? body.whatsappNumber.trim()
        : "";

    const country =
      typeof body.country === "string"
        ? body.country.trim()
        : "";

    const dateOfBirth =
      typeof body.dateOfBirth === "string"
        ? body.dateOfBirth.trim()
        : "";

    if (!firstName || !lastName || !country || !dateOfBirth) {
      return NextResponse.json(
        { error: "Please complete all required registration fields." },
        { status: 400 }
      );
    }

    if (whatsappNumber && !/^\+?[0-9\s()-]{7,20}$/.test(whatsappNumber)) {
      return NextResponse.json(
        { error: "Enter a valid WhatsApp number." },
        { status: 400 }
      );
    }

    const dob = new Date(dateOfBirth);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(dob.getTime()) ||
      dob.toISOString().slice(0, 10) !== dateOfBirth ||
      dob > new Date()
    ) {
      return NextResponse.json(
        { error: "Enter a valid date of birth." },
        { status: 400 }
      );
    }

    if (body.acceptedPolicies !== true) {
      return NextResponse.json(
        {
          error: "You must agree to the Terms of Use before registering.",
        },
        { status: 400 }
      );
    }

    const today = new Date();
    const birthYear = dob.getUTCFullYear();
    const birthMonth = dob.getUTCMonth();
    const birthDay = dob.getUTCDate();

    let age = today.getUTCFullYear() - birthYear;

    if (
      today.getUTCMonth() < birthMonth ||
      (
        today.getUTCMonth() === birthMonth &&
        today.getUTCDate() < birthDay
      )
    ) {
      age--;
    }

    if (age < 13) {
      return NextResponse.json(
        {
          error: "You must be at least 13 years old to register.",
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

   const existingUsername = await db.orm.public.User.first({
    username,
   });

if (existingUsername) {
  return NextResponse.json(
    { error: "That username is already taken. Please choose another." },
    { status: 409 }
  );
} 
    if (!username) {
  return NextResponse.json(
    { error: "A username is required." },
    { status: 400 }
  );
}

if (!/^[a-z0-9_]{3,20}$/.test(username)) {
  return NextResponse.json(
    {
      error: "Username must be 3–20 characters and contain only letters, numbers or underscores.",
    },
    { status: 400 }
  );
}
    const passwordHash = await hashPassword(password);

    const result = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User.create({
        email,
        username,
        name,
        firstName,
        lastName,
        passwordHash,
        whatsappNumber: whatsappNumber || null,
        country,
        dateOfBirth,
        emailVerified: false,
      });

      await tx.orm.public.FanProfile.create({
        userId: user.id,
        displayName: username,
        fanLevel: "NEW_FAN",
        totalPoints: 0,
        currentPoints: 0,
        progressionPoints: 0,
        matchesWatched: 0,
        challengesCompleted: 0,
        fanRoomsJoined: 0,
      });

      const code = generateVerificationCode();

      await tx.orm.public.EmailVerificationCode.create({
        userId: user.id,
        codeHash: hashVerificationCode(user.id, code),
        expiresAt: new Date(
          Date.now() + VERIFICATION_CODE_TTL_MS
        ).toISOString(),
        attempts: 0,
      });

      return { user, code };
    });

    let verificationEmailSent = false;

    try {
      await sendVerificationEmail(
        result.user.email,
        result.code
      );

      verificationEmailSent = true;
    } catch (emailError) {
      console.error(
        "Registration completed, but verification email delivery failed:",
        emailError
      );
    }

    return NextResponse.json(
      {
        success: true,
        requiresEmailVerification: true,
        verificationEmailSent,
        email: result.user.email,
        message: verificationEmailSent
          ? "Registration successful. Check your email for your verification code."
          : "Your account was created, but we could not send your verification email. Please request a new code on the verification page.",
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