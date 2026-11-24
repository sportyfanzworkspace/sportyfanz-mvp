import { NextResponse, NextRequest } from "next/server";
import {
  GUEST_NEWS_COOKIE,
  isValidGuestNewsToken,
  hashGuestNewsToken,
  createGuestNewsToken,
  guestNewsCookieOptions,
} from "@/lib/guest-news-engagement";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function validArticleUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (["bbc.co.uk", "bbc.com", "bbci.co.uk", "skysports.com"].some(
        (domain) => host === domain || host.endsWith(`.${domain}`)
      ))
    );
  } catch {
    return false;
  }
}

async function activeUser() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user || user.status !== "ACTIVE") return null;

  return { id: userId, name: user.name, username: user.username };
}

export async function GET(request: NextRequest) {
  try {
    const articleUrl = request.nextUrl.searchParams.get("url");

    if (!validArticleUrl(articleUrl)) {
      return jsonError("A valid news article URL is required.");
    }

    const user = await activeUser();

    const guestToken = request.cookies.get(GUEST_NEWS_COOKIE)?.value;

    const guestTokenHash =
      !user && isValidGuestNewsToken(guestToken)
        ? hashGuestNewsToken(guestToken)
        : null;

    const [articleLikes, allComments, allViews] = await Promise.all([
      db.orm.public.NewsArticleLike.where({ articleUrl }).all(),
      db.orm.public.NewsComment.where({ articleUrl }).all(),
      db.orm.public.NewsView.where({ articleUrl }).all(),
    ]);

    const comments = await Promise.all(
      allComments
        .filter((comment) => comment.parentId === null)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        )
        .slice(0, 100)
        .map(async (comment) => {
          const author = comment.userId
            ? await db.orm.public.User
                .where({ id: comment.userId })
                .first()
            : null;

          return {
            id: comment.id,
            body: comment.body,
            createdAt: comment.createdAt,
            author: comment.userId
              ? author?.name || author?.username || "Fan"
              : comment.guestName || "Guest Fan",
            userId: comment.userId,
          };
        })
    );

    return NextResponse.json({
      isAuthenticated: Boolean(user),
      views: allViews.length,
      likes: articleLikes.length,
      likedByMe: user
        ? articleLikes.some((like) => like.userId === user.id)
        : guestTokenHash !== null &&
          articleLikes.some(
            (like) => like.guestTokenHash === guestTokenHash
          ),
      commentsCount: allComments.filter(
        (comment) => comment.parentId === null
      ).length,
      comments,
    });
  } catch (error) {
    console.error("GET /api/news/engagement failed:", error);
    return jsonError("Unable to load news engagement.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    const allowedOrigins = new Set([
      "https://sportyfanz.com",
      "https://www.sportyfanz.com",
      ...(process.env.NODE_ENV !== "production"
        ? [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
          ]
        : []),
      ...(process.env.CORS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ]);

    if (!origin || !allowedOrigins.has(origin)) {
      return jsonError("Request origin is not permitted.", 403);
    }

    const user = await activeUser();

    const existingGuestToken =
      request.cookies.get(GUEST_NEWS_COOKIE)?.value;

    const guestToken =
      !user && isValidGuestNewsToken(existingGuestToken)
        ? existingGuestToken
        : !user
          ? createGuestNewsToken()
          : null;

    const guestTokenHash = guestToken
      ? hashGuestNewsToken(guestToken)
      : null;

    function guestResponse(
      payload: Record<string, unknown>,
      status = 200
    ) {
      const response = NextResponse.json(payload, { status });

      if (!user && guestToken) {
        response.cookies.set(
          GUEST_NEWS_COOKIE,
          guestToken,
          guestNewsCookieOptions()
        );
      }

      return response;
    }

    let body: {
      url?: unknown;
      action?: unknown;
      text?: unknown;
      guestName?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.");
    }

    const { url, action, text, guestName } = body;

    if (!validArticleUrl(url)) {
      return jsonError("A valid news article URL is required.");
    }

    if (action === "view") {
      const existingViews = user
        ? await db.orm.public.NewsView
            .where({ articleUrl: url, userId: user.id })
            .all()
        : await db.orm.public.NewsView
            .where({ articleUrl: url, visitorKey: guestTokenHash })
            .all();

      const since = Date.now() - 24 * 60 * 60 * 1000;

      const viewedRecently = existingViews.some(
        (view) => new Date(view.createdAt).getTime() >= since
      );

      if (!viewedRecently) {
        await db.orm.public.NewsView.create({
          articleUrl: url,
          userId: user?.id ?? null,
          visitorKey: user ? null : guestTokenHash,
        });
      }

      return guestResponse({ success: true });
    }

    if (action === "like") {
      const existing = user
        ? await db.orm.public.NewsArticleLike
            .where({ articleUrl: url, userId: user.id })
            .first()
        : await db.orm.public.NewsArticleLike
            .where({
              articleUrl: url,
              guestTokenHash: guestTokenHash!,
            })
            .first();

      if (existing) {
        await db.orm.public.NewsArticleLike
          .where({ id: existing.id })
          .delete();
      } else {
        try {
          await db.orm.public.NewsArticleLike.create({
            articleUrl: url,
            userId: user?.id ?? null,
            guestTokenHash: user ? null : guestTokenHash,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message.toLowerCase() : "";

          const code =
            typeof error === "object" &&
            error !== null &&
            "code" in error
              ? error.code
              : null;

          const isDuplicate =
            code === "23505" ||
            code === "P2002" ||
            message.includes("unique constraint") ||
            message.includes("duplicate key") ||
            message.includes("unique violation");

          if (!isDuplicate) throw error;

          const duplicate = user
            ? await db.orm.public.NewsArticleLike
                .where({ articleUrl: url, userId: user.id })
                .first()
            : await db.orm.public.NewsArticleLike
                .where({
                  articleUrl: url,
                  guestTokenHash: guestTokenHash!,
                })
                .first();

          if (!duplicate) throw error;
        }
      }

      const likes = await db.orm.public.NewsArticleLike
        .where({ articleUrl: url })
        .all();

      const likedByMe = user
        ? likes.some((like) => like.userId === user.id)
        : likes.some(
            (like) => like.guestTokenHash === guestTokenHash
          );

      return guestResponse({
        success: true,
        likedByMe,
        likes: likes.length,
      });
    }

    if (action === "comment") {
      if (typeof text !== "string" || !text.trim()) {
        return jsonError("Write a comment before posting.");
      }

      const bodyText = text.trim();

      if (bodyText.length > 2000) {
        return jsonError("Comments must be 2,000 characters or fewer.");
      }

      let displayName: string | null = null;

      if (!user) {
        if (typeof guestName !== "string") {
          return jsonError("Enter your display name to comment.");
        }

        displayName = guestName.trim();

        if (
          displayName.length < 2 ||
          displayName.length > 40
        ) {
          return jsonError(
            "Your display name must contain 2 to 40 characters."
          );
        }
      }

      const now = new Date().toISOString();

      const comment = await db.orm.public.NewsComment.create({
        articleUrl: url,
        userId: user?.id ?? null,
        guestTokenHash: user ? null : guestTokenHash,
        guestName: user ? null : displayName,
        body: bodyText,
        parentId: null,
        updatedAt: now,
      });

      return guestResponse({
        success: true,
        comment: {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          author: user
            ? user.name || user.username || "Fan"
            : displayName,
          userId: user?.id ?? null,
        },
      }, 201);
    }

    return jsonError("Unsupported engagement action.");
  } catch (error) {
    console.error("POST /api/news/engagement failed:", error);
    return jsonError("Unable to save your action.", 500);
  }
}
