import Parser from "rss-parser";
import { NextResponse } from "next/server";
import { summarizeSportsStory } from "@/lib/news-summarizer";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";
export const revalidate = 600;

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "SportyFanzNews/1.0",
  },
  customFields: {
    item: [
      "media:content",
      "media:thumbnail",
      "enclosure",
      "content:encoded",
    ],
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
  seoHeadline: string;
  summary: string;
  feedSummary: string;
  articleSummary: string;
  category: string;
  source: string;
  publishedAt: string | null;
  link: string;
  image: string | null;
};

type FeedItem = Parser.Item & {
  "content:encoded"?: string;
  "media:content"?: unknown;
  "media:thumbnail"?: unknown;
  enclosure?: {
    url?: string;
    type?: string;
  };
};

function decodeFeedText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, number: string) => {
      const code = Number(number);

      return code <= 0x10ffff &&
        !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, number: string) => {
      const code = parseInt(number, 16);

      return code <= 0x10ffff &&
        !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : " ";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractSummary(item: FeedItem): string {
  const candidates = [
    item["content:encoded"],
    item.content,
    item.contentSnippet,
    item.summary,
  ];

  const cleaned = candidates
    .filter((value): value is string => typeof value === "string")
    .map(decodeFeedText)
    .filter(Boolean);

  // Use the longest text supplied by the feed.
  return cleaned.sort((a, b) => b.length - a.length)[0]?.slice(0, 5000) ?? "";
}

function getImage(item: FeedItem): string | null {
  const enclosure = item.enclosure;

  if (enclosure?.url && enclosure.type?.startsWith("image/")) {
    return enclosure.url;
  }

  const raw = item as Record<string, unknown>;

  const mediaContent = raw["media:content"] as
    | { $?: { url?: string } }
    | { $?: { url?: string } }[]
    | undefined;

  const media = Array.isArray(mediaContent)
    ? mediaContent[0]
    : mediaContent;

  if (media?.$?.url) {
    return media.$.url;
  }

  const thumbnail = raw["media:thumbnail"] as
    | { $?: { url?: string } }
    | undefined;

  return thumbnail?.$?.url ?? null;
}

function getCategory(title: string, categories?: string[]): string {
  const text = title.toLowerCase();

  if (/rugby/.test(text)) return "Rugby";
  if (/cricket/.test(text)) return "Cricket";

  if (/formula.?1|f1|grand prix|motorsport/.test(text)) {
    return "Formula 1";
  }

  if (/tennis|wimbledon|atp|wta/.test(text)) {
    return "Tennis";
  }

  if (/basketball|nba/.test(text)) {
    return "Basketball";
  }

  if (/transfer|signing|contract/.test(text)) {
    return "Transfers";
  }

  if (/football|premier league|champions league|soccer/.test(text)) {
    return "Football";
  }

  const supplied = categories?.[0]?.trim();

  if (
    supplied &&
    !/^(sports|news story|article\/blog|liveblog)$/i.test(supplied)
  ) {
    return supplied;
  }

  return "Sports";
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);

    url.hash = "";

    // Remove tracking parameters so duplicate feed entries can be merged.
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.startsWith("utm_") ||
        ["at_medium", "at_campaign", "ocid"].includes(key)
      ) {
        url.searchParams.delete(key);
      }
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return value.split("?")[0].replace(/\/$/, "");
  }
}

async function fetchFeed(
  feed: (typeof FEEDS)[number]
): Promise<NewsStory[]> {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "SportyFanzNews/1.0",
      },
      signal: AbortSignal.timeout(10000),
      next: {
        revalidate: 600,
      },
    });

    if (!response.ok) {
      throw new Error(`Feed returned HTTP ${response.status}`);
    }

    const xml = await response.text();
    const parsed = await parser.parseString(xml);

    const stories = await Promise.all(
      parsed.items.map(async (rawItem): Promise<NewsStory | null> => {
        const item = rawItem as FeedItem;
        const title = (item.title || "Sports news").trim();
        const link = (item.link || "").trim();

        if (!link) {
          return null;
        }

        const rawDate = item.isoDate || item.pubDate;
        const date = rawDate ? new Date(rawDate) : null;

        const publishedAt =
          date && !Number.isNaN(date.getTime())
            ? date.toISOString()
            : null;

        const summary = extractSummary(item);

        // Use RSS text for the news feed.
       // Gemini summaries will be generated on demand on the article page.
      const feedSummary = summary
        ? summary.trim().split(/\s+/).slice(0, 45).join(" ")
        : "";

       const articleSummary = summary
         ? summary.trim().split(/\s+/).slice(0, 150).join(" ")
         : "";

        return {
          id: `${feed.name}-${canonicalUrl(link) || title}`,
          title,
          seoHeadline: title,
          summary,
          feedSummary: feedSummary || summary,
          articleSummary: articleSummary || summary,
          category: getCategory(title, item.categories),
          source: feed.name,
          publishedAt,
          link,
          image: getImage(item),
        };
      })
    );

    return stories.filter(
      (story): story is NewsStory => story !== null
    );
  } catch (error) {
    console.error(`SportyFanz news feed error (${feed.name}):`, error);
    return [];
  }
}

type CachedNewsResult = {
  stories: NewsStory[];
  updatedAt: string;
};

const getCachedNews = unstable_cache(
  async (): Promise<CachedNewsResult> => {
    const results = await Promise.all(FEEDS.map(fetchFeed));

    const seen = new Set<string>();

    const stories = results
      .flat()
      .filter((story) => {
        const key = canonicalUrl(story.link);

        if (!key || seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const dateA = a.publishedAt
          ? Date.parse(a.publishedAt)
          : 0;

        const dateB = b.publishedAt
          ? Date.parse(b.publishedAt)
          : 0;

        return dateB - dateA;
      });

    return {
      stories,
      // This timestamp is created only when the cached function runs.
      updatedAt: new Date().toISOString(),
    };
  },
  ["sportyfanz-cached-news-feed-v2"],
  {
    revalidate: 600,
    tags: ["sportyfanz-news"],
  }
);

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