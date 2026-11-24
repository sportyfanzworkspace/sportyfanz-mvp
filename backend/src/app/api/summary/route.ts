
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { summarizeSportsStory } from "@/lib/news-summarizer";

export const runtime = "nodejs";

const allowedHosts = [
  "bbc.co.uk",
  "bbc.com",
  "bbci.co.uk",
  "skysports.com",
];

function getPublisher(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;

    const host = url.hostname.toLowerCase();

    const allowed = allowedHosts.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );

    if (!allowed) return null;

    return host.endsWith("skysports.com")
      ? "Sky Sports"
      : "BBC Sport";
  } catch {
    return null;
  }
}

const getCachedArticleSummary = unstable_cache(
  async (
    title: string,
    sourceText: string,
    source: string,
    articleUrl: string
  ) => {
    return summarizeSportsStory(
      title,
      sourceText,
      source,
      articleUrl
    );
  },
  ["sportyfanz-article-summary-v3"],
  {
    revalidate: 86400,
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const sourceText =
      typeof body.sourceText === "string"
        ? body.sourceText.trim()
        : "";

    const articleUrl =
      typeof body.url === "string" ? body.url.trim() : "";

    if (
      !title ||
      title.length > 500 ||
      sourceText.length > 5000 ||
      !articleUrl ||
      articleUrl.length > 2048
    ) {
      return NextResponse.json(
        { error: "Invalid article details." },
        { status: 400 }
      );
    }

    const source = getPublisher(articleUrl);

    if (!source) {
      return NextResponse.json(
        { error: "Unsupported article publisher." },
        { status: 400 }
      );
    }

    const summary = await getCachedArticleSummary(
      title,
      sourceText,
      source,
      articleUrl
    );

    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Article summary endpoint error:", error);

    return NextResponse.json(
      { error: "Unable to generate the article summary." },
      { status: 500 }
    );
  }
}
