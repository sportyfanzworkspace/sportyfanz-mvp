
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";

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

function categoryFor(story: NewsStory) {
  const text = `${story.title} ${story.link}`.toLowerCase();

  if (/rugby/.test(text)) return "Rugby";
  if (/cricket/.test(text)) return "Cricket";
  if (/formula.?1|f1|grand prix|motorsport/.test(text)) return "Formula 1";
  if (/tennis|wimbledon|atp|wta/.test(text)) return "Tennis";
  if (/basketball|nba/.test(text)) return "Basketball";
  if (/transfer|signing|contract/.test(text)) return "Transfers";
  if (/football|premier league|champions league|soccer/.test(text)) {
    return "Football";
  }

  return story.category === "Sports" ||
    story.category === "News Story" ||
    story.category === "Article/Blog"
    ? "Sports"
    : story.category;
}

function timeAgo(date: string | null) {
  if (!date) return "Recently";

  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  if (!Number.isFinite(elapsed)) return "Recently";

  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function articleHref(story: NewsStory) {
  return `/app/news/article?url=${encodeURIComponent(story.link)}`;
}

export default function NewsPage() {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      try {
        const response = await fetch("/api/news", { cache: "no-store" });
        if (!response.ok) throw new Error("News feed unavailable");

        const data = await response.json();
        const seen = new Set<string>();

        const uniqueStories: NewsStory[] = (data.stories || []).filter(
          (story: NewsStory) => {
            if (!story.link || !story.title) return false;

            const key = story.link.split("?")[0].replace(/\/$/, "");
            if (seen.has(key)) return false;

            seen.add(key);
            return true;
          }
        );

        if (!cancelled) {
          setStories(uniqueStories);
          setError(uniqueStories.length ? "" : "No stories are available right now.");
        }
      } catch {
        if (!cancelled) {
          setError("Sports news is temporarily unavailable. Please try again shortly.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNews();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredStories = stories.filter((story) => story.image);
  const featured = featuredStories.length
    ? featuredStories[activeSlide % featuredStories.length]
    : stories[activeSlide % Math.max(stories.length, 1)];

  const trendingStories = stories.filter((story) => story.id !== featured?.id);

  function moveSlide(direction: number) {
    if (!featuredStories.length) return;

    setActiveSlide((current) =>
      (current + direction + featuredStories.length) % featuredStories.length
    );
  }

  if (loading) {
    return (
      <main className="news-page">
        <div className="news-heading">
          <span className="news-eyebrow">THE LATEST FROM THE WORLD OF SPORT</span>
          <h1>Sports News</h1>
          <p>Breaking stories, match updates and conversations fans care about.</p>
        </div>
        <p role="status">Loading the latest sports news…</p>
      </main>
    );
  }

  if (!stories.length) {
    return (
      <main className="news-page">
        <div className="news-heading">
          <span className="news-eyebrow">THE LATEST FROM THE WORLD OF SPORT</span>
          <h1>Sports News</h1>
          <p>{error || "No stories are available right now."}</p>
          <button
            type="button"
            className="news-read-button"
            onClick={() => window.location.reload()}
          >
            Try again →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="news-page">
      <div className="news-heading">
        <span className="news-eyebrow">THE LATEST FROM THE WORLD OF SPORT</span>
        <h1>Sports News</h1>
        <p>Breaking stories, match updates and conversations fans care about.</p>
      </div>

      {featured && (
        <section className="news-hero" aria-label="Featured sports story">
          {featured.image && (
            <Image
              src={featured.image}
              alt=""
              fill
              priority
              unoptimized
              sizes="(max-width: 900px) 100vw, 1200px"
              className="news-hero-image"
            />
          )}
          <div className="news-hero-shade" />

          <div className="news-hero-content">
            <span className="news-hero-brand">
              <span className="news-brand-mark">S</span>
              {categoryFor(featured).toUpperCase()} · {featured.source}
            </span>

            <h2>{featured.title}</h2>
            <p>{featured.summary || "Read the latest update from the publisher."}</p>

            <Link href={articleHref(featured)} className="news-read-button">
              Read Full Story <span>→</span>
            </Link>
            <small>{timeAgo(featured.publishedAt)}</small>
          </div>

          {featuredStories.length > 1 && (
            <div className="news-hero-controls">
              <div className="news-dots">
                {featuredStories.map((story, index) => (
                  <button
                    key={story.id}
                    type="button"
                    aria-label={`Show featured story ${index + 1}`}
                    aria-current={activeSlide === index}
                    className={activeSlide === index ? "active" : ""}
                    onClick={() => setActiveSlide(index)}
                  />
                ))}
              </div>

              <span className="news-slide-count">
                {(activeSlide % featuredStories.length) + 1}/
                {featuredStories.length}
              </span>

              <button
                type="button"
                aria-label="Previous featured story"
                onClick={() => moveSlide(-1)}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                aria-label="Next featured story"
                onClick={() => moveSlide(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </section>
      )}

      <section className="trending-stories">
        <div className="trending-heading">
          <h2>
            <span className="trending-icon">◈</span>
            Latest Stories
          </h2>
          <span>{stories.length} stories</span>
        </div>

        {error && <p role="status">{error}</p>}

        <div className="trending-list">
          {trendingStories.map((story, index) => (
            <Link
              className="trending-story"
              key={story.id}
              href={articleHref(story)}
            >
              {story.image ? (
                <Image
                  src={story.image}
                  alt=""
                  width={64}
                  height={54}
                  unoptimized
                  className="trending-thumbnail"
                />
              ) : (
                <div className="trending-thumbnail" aria-hidden="true" />
              )}

              <div className="trending-story-content">
                <span className="trending-category">
                  {categoryFor(story)} · {story.source}
                </span>
                <h3>{story.title}</h3>

                <div className="trending-meta">
                  <span>{timeAgo(story.publishedAt)}</span>
                  <span className="trending-comments">
                    <MessageCircle size={12} />
                    News
                  </span>
                </div>
              </div>

              <span className="trending-row-number">
                {String(index + 1).padStart(2, "0")}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
