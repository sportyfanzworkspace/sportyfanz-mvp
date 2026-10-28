import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  try {
    const articleUrl = new URL(request.url).searchParams.get("url");
    if (!validArticleUrl(articleUrl)) {
      return jsonError("A valid news article URL is required.");
    }

    const user = await activeUser();
    if (!user) return jsonError("Please log in to view news engagement.", 401);

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
          const author = await db.orm.public.User
            .where({ id: comment.userId })
            .first();

          return {
            id: comment.id,
            body: comment.body,
            createdAt: comment.createdAt,
            author: author?.name || author?.username || "Fan",
            userId: comment.userId,
          };
        })
    );

    return NextResponse.json({
      views: allViews.length,
      likes: articleLikes.length,
      likedByMe: articleLikes.some((like) => like.userId === user.id),
      commentsCount: allComments.filter((comment) => comment.parentId === null).length,
      comments,
    });
  } catch (error) {
    console.error("GET /api/news/engagement failed:", error);
    return jsonError("Unable to load news engagement.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await activeUser();
    if (!user) return jsonError("Please log in to continue.", 401);

    let body: {
      url?: unknown;
      action?: unknown;
      text?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.");
    }

    const { url, action, text } = body;

    if (!validArticleUrl(url)) {
      return jsonError("A valid news article URL is required.");
    }

    if (action === "view") {
      // Count at most one view per signed-in user per article per day.
      const existingViews = await db.orm.public.NewsView
        .where({ articleUrl: url, userId: user.id })
        .all();

      const since = Date.now() - 24 * 60 * 60 * 1000;
      const viewedRecently = existingViews.some(
        (view) => new Date(view.createdAt).getTime() >= since
      );

      if (!viewedRecently) {
        await db.orm.public.NewsView.create({
          articleUrl: url,
          userId: user.id,
          visitorKey: null,
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "like") {
      const existing = await db.orm.public.NewsArticleLike
        .where({ articleUrl: url, userId: user.id })
        .first();

      if (existing) {
        await db.orm.public.NewsArticleLike
          .where({ articleUrl: url, userId: user.id })
          .delete();
      } else {
        await db.orm.public.NewsArticleLike.create({
          articleUrl: url,
          userId: user.id,
        });
      }

      const likes = await db.orm.public.NewsArticleLike
        .where({ articleUrl: url })
        .all();

      return NextResponse.json({
        success: true,
        likedByMe: !existing,
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

      const now = new Date().toISOString();

      const comment = await db.orm.public.NewsComment.create({
        articleUrl: url,
        userId: user.id,
        body: bodyText,
        parentId: null,
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        comment: {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          author: user.name || user.username || "Fan",
          userId: user.id,
        },
      }, { status: 201 });
    }

    return jsonError("Unsupported engagement action.");
  } catch (error) {
    console.error("POST /api/news/engagement failed:", error);
    return jsonError("Unable to save your action.", 500);
  }
}
