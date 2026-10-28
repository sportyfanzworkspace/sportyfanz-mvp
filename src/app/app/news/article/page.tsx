
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
};

const allowedHosts = [
  "bbc.co.uk",
  "bbc.com",
  "bbci.co.uk",
  "skysports.com",
];

function ArticleContent() {
  const params = useSearchParams();
  const url = params.get("url");

  const [story, setStory] = useState<NewsStory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStory() {
      if (!url) {
        setLoading(false);
        return;
      }

      try {
        const parsedUrl = new URL(url);

        const allowed = allowedHosts.some(
          (host) =>
            parsedUrl.hostname === host ||
            parsedUrl.hostname.endsWith(`.${host}`)
        );

        if (parsedUrl.protocol !== "https:" || !allowed) {
          setLoading(false);
          return;
        }

        const response = await fetch("/api/news", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load news");
        }

        const data = await response.json();
        const stories = data.stories as NewsStory[];

        const found = stories.find((item) => {
          try {
            const itemUrl = new URL(item.link);
            const requestedUrl = new URL(url);

            return (
              itemUrl.hostname === requestedUrl.hostname &&
              itemUrl.pathname === requestedUrl.pathname
            );
          } catch {
            return item.link === url;
          }
        });

        if (!cancelled) {
          setStory(found || null);
        }
      } catch {
        if (!cancelled) {
          setStory(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStory();

    return () => {
      cancelled = true;
    };
  }, [url]);

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

  return (
    <main className="news-page">
      <Link href="/app/news" className="news-read-button">
        <ArrowLeft size={16} />
        Back to Sports News
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

          {story.summary ? (
            story.summary
              .split(/\n{2,}/)
              .map((paragraph, index) => (
                <p
                  key={index}
                  style={{
                    color: "#111111",
                    margin: "0 0 22px",
                    whiteSpace: "pre-line",
                  }}
                >
                  {paragraph.trim()}
                </p>
              ))
          ) : (
            <p style={{ color: "#111111" }}>
              A detailed summary is not available in the current news feed.
            </p>
          )}

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
