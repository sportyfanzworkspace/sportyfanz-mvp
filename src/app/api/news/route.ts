import { NextResponse } from "next/server";
import { getCachedNews } from "@/lib/news-feed";

export const runtime = "nodejs";
export const revalidate = 600;

export async function GET() {
  try {
    const cachedNews = await getCachedNews();

    return NextResponse.json(cachedNews, {
      headers: {
        "Cache-Control":
          "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (error) {
    console.error("SportyFanz cached news error:", error);

    return NextResponse.json(
      {
        stories: [],
        updatedAt: null,
        error: "Unable to load sports news.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}