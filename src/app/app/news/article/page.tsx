
"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

type NewsStory = {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
  publishedAt: string | null;
  link: string;
  image: string | null;
  feedSummary?: string;
  articleSummary?: string;
};

type NewsResponse = {
  stories: NewsStory[];
};

type SummaryResponse = {
  feedSummary?: string;
  articleSummary?: string;
  error?: string;
};

const allowedHosts = [
  "bbc.co.uk",
  "bbc.com",
  "bbci.co.uk",
  "skysports.com",
];

function isAllowedArticleUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);

    return (
      parsedUrl.protocol === "https:" &&
      allowedHosts.some(
        (host) =>
          parsedUrl.hostname.toLowerCase() === host ||
          parsedUrl.hostname.toLowerCase().endsWith(`.${host}`)
      )
    );
  } catch {
    return false;
  }
}

function ArticleContent() {
  const params = useSearchParams();
  const url = params.get("url");

  const [story, setStory] = useState<NewsStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Load the requested story from the existing news feed.
  useEffect(() => {
    let cancelled = false;

    async function loadStory() {
      setLoading(true);
      setStory(null);
      setSummaryLoading(false);

      if (!url || !isAllowedArticleUrl(url)) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/news", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load news");
        }

        const data: NewsResponse = await response.json();

        const requestedUrl = new URL(url);

        const found = data.stories.find((item) => {
          try {
            const itemUrl = new URL(item.link);

            return (
              itemUrl.hostname.toLowerCase() ===
                requestedUrl.hostname.toLowerCase() &&
              itemUrl.pathname === requestedUrl.pathname
            );
          } catch {
            return false;
          }
        });

        if (!cancelled) {
          setStory(found ?? null);
        }
      } catch (error) {
        console.error("Unable to load news article:", error);

        if (!cancelled) {
          setStory(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStory();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Request a longer summary only after the story has loaded.
  useEffect(() => {
    if (!story || !isAllowedArticleUrl(story.link)) {
      return;
    }

    let cancelled = false;

    const currentLink = story.link;

    async function generateSummary() {
      setSummaryLoading(true);

      try {
        const response = await fetch("/api/news/summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: story!.title,
            sourceText:
              story!.summary?.trim() ||
              story!.feedSummary?.trim() ||
              "",
            url: currentLink,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Summary request failed: ${response.status}`
          );
        }

        const data: SummaryResponse = await response.json();

        if (
          !cancelled &&
          typeof data.articleSummary === "string" &&
          data.articleSummary.trim()
        ) {
          setStory((current) => {
            if (!current || current.link !== currentLink) {
              return current;
            }

            return {
              ...current,
              feedSummary:
                data.feedSummary?.trim() ||
                current.feedSummary,
              articleSummary: data.articleSummary!.trim(),
            };
          });
        }
      } catch (error) {
        // Keep the RSS summary visible if Gemini is unavailable.
        console.error("Article summary unavailable:", error);
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    }

    void generateSummary();

    return () => {
      cancelled = true;
    };
  }, [story?.link]);

  if (loading) {
    return (
      <main className="news-page">
        <p>Loading story…</p>
      </main>
    );
  }

  if (!story) {
    return (
      <main className="news-page">
        <Link href="/app/news" className="news-read-button">
          <ArrowLeft size={16} />
          Back to Sports News
        </Link>

        <h1>Story unavailable</h1>

        <p>
          This story may have expired from the feed.
          Please return to the latest news.
        </p>
      </main>
    );
  }

  const articleText =
    story.articleSummary?.trim() ||
    story.feedSummary?.trim() ||
    story.summary?.trim() ||
    "A detailed summary is not available for this story yet.";

  return (
    <main className="news-page">
      <Link href="/app/news" className="news-read-button">
        <ArrowLeft size={16} />
        Back
      </Link>

      <article
        style={{
          maxWidth: 900,
          margin: "28px auto",
          color: "#111111",
        }}
      >
        <span
          className="news-eyebrow"
          style={{ color: "#222222" }}
        >
          {story.category}
        </span>

        <h1
          style={{
            color: "#111111",
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            lineHeight: 1.15,
            marginTop: 12,
          }}
        >
          {story.title}
        </h1>

        <p
          style={{
            color: "#444444",
            margin: "16px 0 24px",
          }}
        >
          {story.publishedAt
            ? new Date(story.publishedAt).toLocaleString()
            : "Latest update"}
        </p>

        {story.image && (
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              overflow: "hidden",
              borderRadius: 14,
              marginBottom: 24,
            }}
          >
            <Image
              src={story.image}
              alt={story.title}
              fill
              unoptimized
              sizes="(max-width: 900px) 100vw, 900px"
              style={{ objectFit: "cover" }}
            />
          </div>
        )}

        <div
          className="news-article-body"
          style={{
            color: "#111111",
            background: "#ffffff",
            fontSize: 18,
            lineHeight: 1.9,
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              color: "#111111",
              fontSize: 26,
              lineHeight: 1.3,
              marginBottom: 18,
            }}
          >
            Story Summary
          </h2>

          <div className="news-article-summary">
            {articleText
              .split(/\n\s*\n/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, index) => (
             <p
              key={index}
              className="mb-4 leading-7"
             >
               {paragraph}
             </p>
             ))}
            {summaryLoading && (
              <p
                style={{
                  color: "#666666",
                  fontSize: 14,
                }}
              >
                Preparing a more detailed story summary…
              </p>
            )}
          </div>

          <a
            href={story.link}
            target="_blank"
            rel="noopener noreferrer"
            className="news-read-button"
            style={{ marginTop: 24 }}
          >
            Read the complete article
            <ExternalLink size={16} />
          </a>
        </div>
      </article>
    </main>
  );
}

export default function NewsArticlePage() {
  return (
    <Suspense
      fallback={
        <main className="news-page">
          <p>Loading story…</p>
        </main>
      }
    >
      <ArticleContent />
    </Suspense>
  );
}
