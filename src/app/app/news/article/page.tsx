
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

        const response = await fetch("/api/news", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load news");

        const data = await response.json();
        const found = (data.stories as NewsStory[]).find(
          (item) => item.link === url
        );

        if (!cancelled) setStory(found || null);
      } catch {
        if (!cancelled) setStory(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStory();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return <main className="news-page"><p>Loading story…</p></main>;
  }

  if (!story) {
    return (
      <main className="news-page">
        <Link href="/app/news" className="news-read-button">
          <ArrowLeft size={16} /> Back to Sports News
        </Link>
        <h1>Story unavailable</h1>
        <p>This story may have expired from the feed. Please return to the latest news.</p>
      </main>
    );
  }

  return (
    <main className="news-page">
      <Link href="/app/news" className="news-read-button">
        <ArrowLeft size={16} /> Back to Sports News
      </Link>

      <article style={{ maxWidth: 900, margin: "28px auto" }}>
        <span className="news-eyebrow">
          {story.category} · {story.source}
        </span>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.15 }}>
          {story.title}
        </h1>

        <p style={{ color: "var(--sf-muted)", margin: "16px 0 24px" }}>
          {story.publishedAt
            ? new Date(story.publishedAt).toLocaleString()
            : "Latest update"}{" "}
          · Published by {story.source}
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
              alt=""
              fill
              unoptimized
              sizes="(max-width: 900px) 100vw, 900px"
              style={{ objectFit: "cover" }}
            />
          </div>
        )}

        <p style={{ fontSize: "1.15rem", lineHeight: 1.8 }}>
          {story.summary || "Read the original publisher's report for the full story."}
        </p>

        <p style={{ marginTop: 16, lineHeight: 1.8 }}>
          This is a news summary from {story.source}. Visit the publisher for
          the complete report, additional context and any updates.
        </p>

        <a
          href={story.link}
          target="_blank"
          rel="noopener noreferrer"
          className="news-read-button"
          style={{ display: "inline-flex", marginTop: 24, gap: 10 }}
        >
          Read original article <ExternalLink size={16} />
        </a>
      </article>
    </main>
  );
}

export default function NewsArticlePage() {
  return (
    <Suspense fallback={<main className="news-page"><p>Loading story…</p></main>}>
      <ArticleContent />
    </Suspense>
  );
}
