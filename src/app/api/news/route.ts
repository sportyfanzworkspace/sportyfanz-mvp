
import Parser from "rss-parser";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 600;

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "SportyFanzNews/1.0",
  },
  customFields: {
    item: ["media:content", "media:thumbnail", "enclosure"],
  },
});

const FEEDS = [
  {
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
  },
  {
    name: "Sky Sports",
    url: "https://www.skysports.com/rss/12040",
  },
];

type NewsStory = {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
  publishedAt: string | null;
  link: string;
  image: string | null;
};

function getImage(item: Record<string, unknown>): string | null {
  const enclosure = item.enclosure as
    | { url?: string; type?: string }
    | undefined;

  if (enclosure?.url && enclosure.type?.startsWith("image/")) {
    return enclosure.url;
  }

  const mediaContent = item["media:content"] as
    | { $?: { url?: string } }
    | { $?: { url?: string } }[]
    | undefined;

  const media = Array.isArray(mediaContent)
    ? mediaContent[0]
    : mediaContent;

  if (media?.$?.url) return media.$.url;

  const thumbnail = item["media:thumbnail"] as
    | { $?: { url?: string } }
    | undefined;

  if (thumbnail?.$?.url) return thumbnail.$.url;

  return null;
}

function getCategory(title: string, categories?: string[]): string {
  if (categories?.length && categories[0]) {
    return categories[0];
  }

  const text = title.toLowerCase();

  if (/transfer|signing|contract/.test(text)) return "Transfers";
  if (/premier league|manchester|arsenal|chelsea|liverpool/.test(text)) {
    return "Football";
  }
  if (/basketball|nba/.test(text)) return "Basketball";
  if (/tennis|wimbledon|atp|wta/.test(text)) return "Tennis";

  return "Sports";
}

export async function GET() {
  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          headers: { "User-Agent": "SportyFanzNews/1.0" },
          signal: AbortSignal.timeout(10000),
          next: { revalidate: 600 },
        });

        if (!response.ok) {
          throw new Error(`Feed returned HTTP ${response.status}`);
        }

        const xml = await response.text();
        const parsed = await parser.parseString(xml);

        return parsed.items.map((item) => {
          const title = (item.title || "Sports news").trim();
          const link = (item.link || "").trim();
          const rawDate = item.isoDate || item.pubDate;
          const date = rawDate ? new Date(rawDate) : null;
          const validDate =
            date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;

          const rawItem = item as unknown as Record<string, unknown>;
          const summary = (item.contentSnippet || item.content || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 700);

          return {
            id: `${feed.name}-${link || title}`,
            title,
            summary,
            category: getCategory(title, item.categories),
            source: feed.name,
            publishedAt: validDate,
            link,
            image: getImage(rawItem),
          } satisfies NewsStory;
        }).filter((story) => story.link);
      } catch (error) {
        console.error(`SportyFanz news feed error (${feed.name}):`, error);
        return [];
      }
    })
  );

  const seen = new Set<string>();

  const stories = results
    .flat()
    .filter((story) => {
      const key = story.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const dateA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const dateB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return dateB - dateA;
    });

  return NextResponse.json(
    { stories, updatedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    }
  );
}
