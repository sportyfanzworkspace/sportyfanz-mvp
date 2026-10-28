
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Eye,
  Heart,
  Send,
} from "lucide-react";

type NewsStory = {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
  publishedAt: string | null;
  link: string;
  image: string | null;
  views?: number;
  feedSummary: string;
  articleSummary: string;
};

type NewsResponse = {
  stories: NewsStory[];
  updatedAt: string | null;
};

type NewsComment = {
  id: number;
  body: string;
  createdAt: string;
  author: string;
  userId: number;
};

type Engagement = {
  views: number;
  likes: number;
  likedByMe: boolean;
  commentsCount: number;
  comments: NewsComment[];
};

function categoryFor(story: NewsStory) {
  const text = `${story.title} ${story.link}`.toLowerCase();

  if (/rugby/.test(text)) return "Rugby";
  if (/cricket/.test(text)) return "Cricket";
  if (/formula.?1|f1|grand prix|motorsport/.test(text)) {
    return "Formula 1";
  }
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

function displayHeadline(story: NewsStory) {
  const title = story.title
    .replace(/^\s*(breaking|news update)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length <= 88) return title;

  const sentenceEnd = title.search(/[.!?]\s/);

  if (sentenceEnd >= 45 && sentenceEnd <= 88) {
    return title.slice(0, sentenceEnd + 1);
  }

  const shorter = title.slice(0, 85);
  const lastSpace = shorter.lastIndexOf(" ");

  return `${shorter
    .slice(0, lastSpace > 55 ? lastSpace : 85)
    .replace(/[,:;–—-]+$/, "")}…`;
}

function timeAgo(date: string | null) {
  if (!date) return "Recently";

  const timestamp = new Date(date).getTime();

  if (!Number.isFinite(timestamp)) return "Recently";

  const elapsed = Math.max(0, Date.now() - timestamp);
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
  const [commentStory, setCommentStory] = useState<NewsStory | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [engagement, setEngagement] = useState<
  Record<string, Engagement>
>({});
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [engagementError, setEngagementError] = useState("");
  const [likeLoading, setLikeLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/news", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("News feed unavailable");
        }

        const data: NewsResponse = await response.json();
        const seen = new Set<string>();

        const uniqueStories = (data.stories || []).filter(
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
          setUpdatedAt(data.updatedAt ?? null);
          setActiveSlide(0);
          setError(
            uniqueStories.length
              ? ""
              : "No stories are available right now."
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "Sports news is temporarily unavailable. Please try again shortly."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNews();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  useEffect(() => {
  if (!stories.length) return;

  stories.forEach((story) => {
    void loadEngagement(story);
  });
}, [stories]);

  const featuredStories = stories
  .filter((story) => story.image)
  .slice(0, 7);

  const featured = featuredStories.length
    ? featuredStories[activeSlide % featuredStories.length]
    : stories[activeSlide % Math.max(stories.length, 1)];

  const trendingStories = stories.filter(
    (story) => story.id !== featured?.id
  );

  function moveSlide(direction: number) {
    if (!featuredStories.length) return;

    setActiveSlide(
      (current) =>
        (current + direction + featuredStories.length) %
        featuredStories.length
    );
  }

  function retryLoadingNews() {
    setRetryCount((current) => current + 1);
  }

  async function loadEngagement(story: NewsStory) {
  try {
    const response = await fetch(
      `/api/news/engagement?url=${encodeURIComponent(story.link)}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load engagement.");
    }

    setEngagement((current) => ({
      ...current,
      [story.link]: data,
    }));
  } catch (error) {
    setEngagementError(
      error instanceof Error ? error.message : "Unable to load comments."
    );
  }
}

async function toggleArticleLike(story: NewsStory) {
  setLikeLoading(story.link);
  setEngagementError("");

  try {
    const response = await fetch("/api/news/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: story.link, action: "like" }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to update like.");
    }

    setEngagement((current) => ({
      ...current,
      [story.link]: {
        ...(current[story.link] ?? {
          views: 0,
          commentsCount: 0,
          comments: [],
        }),
        likes: data.likes,
        likedByMe: data.likedByMe,
      },
    }));
  } catch (error) {
    setEngagementError(
      error instanceof Error ? error.message : "Unable to update like."
    );
  } finally {
    setLikeLoading(null);
  }
}

async function postComment() {
  if (!commentStory || !commentText.trim() || commentLoading) return;

  setCommentLoading(true);
  setEngagementError("");

  try {
    const response = await fetch("/api/news/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: commentStory.link,
        action: "comment",
        text: commentText,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to post comment.");
    }

    await loadEngagement(commentStory);
    setCommentText("");
  } catch (error) {
    setEngagementError(
      error instanceof Error ? error.message : "Unable to post comment."
    );
  } finally {
    setCommentLoading(false);
  }
}

  if (loading) {
    return (
      <main className="news-page">
        <div className="news-heading">
          <span className="news-eyebrow">
            THE LATEST FROM THE WORLD OF SPORT
          </span>
          <h1>Sports News</h1>
          <p>
            Breaking stories, match updates and conversations fans care about.
          </p>
        </div>

        <p role="status">Loading the latest sports news…</p>
      </main>
    );
  }

  if (!stories.length) {
    return (
      <main className="news-page">
        <div className="news-heading">
          <span className="news-eyebrow">
            THE LATEST FROM THE WORLD OF SPORT
          </span>
          <h1>Sports News</h1>
          <p>{error || "No stories are available right now."}</p>

          <button
            type="button"
            className="news-read-button"
            onClick={retryLoadingNews}
          >
            Try again →
          </button>
        </div>
      </main>
    );
  }

  const validUpdatedAt =
    updatedAt && Number.isFinite(new Date(updatedAt).getTime())
      ? updatedAt
      : null;

  return (
    <main className="news-page">
      <div className="news-heading">
        <span className="news-eyebrow">
          THE LATEST FROM THE WORLD OF SPORT
        </span>
        <h1>Sports News</h1>
        <p>
          Breaking stories, match updates and conversations fans care about.
        </p>
      </div>

      {featured && (
        <section
          className="news-hero"
          aria-label="Featured sports story"
        >
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
              {categoryFor(featured).toUpperCase()}
            </span>

            <h2>{displayHeadline(featured)}</h2>

            <p>
              {featured.feedSummary?.trim() ||
                featured.summary?.trim() ||
                "Read the latest update from the publisher."}
            </p>

            <Link
              href={articleHref(featured)}
              className="news-read-button"
            >
              Read Full Story <span>→</span>
            </Link>
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
          {trendingStories.map((story) => (
            <div className="trending-story" key={story.id}>
              <Link
                className="trending-story-link"
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
                  <div
                    className="trending-thumbnail"
                    aria-hidden="true"
                  />
                )}

                <div className="trending-story-content">
                  <span className="trending-category">
                    {categoryFor(story)}
                  </span>

                  <h3>{displayHeadline(story)}</h3>

                  <div className="trending-meta">
                    <span>{timeAgo(story.publishedAt)}</span>
                    {typeof story.views === "number" && story.views > 0 && (
                       <span className="trending-views">
                         <Eye size={13} />
                         {story.views.toLocaleString()}
                       </span>
                     )}
                  </div>
                </div>
              </Link>

                <div className="trending-engagement">
                  <span className="trending-views" title="Article views">
                    <Eye size={15} />
                    {(engagement[story.link]?.views ?? story.views ?? 0).toLocaleString()}
                  </span>

                <button
                  type="button"
                  className={`trending-like ${
                    engagement[story.link]?.likedByMe ? "is-liked" : ""
                  }`}
                  aria-label={
                  engagement[story.link]?.likedByMe
                  ? "Unlike this story"
                  : "Like this story"
                }
                 disabled={likeLoading === story.link}
                 onClick={() => void toggleArticleLike(story)}
                >
                <Heart
                 size={16}
                 fill={engagement[story.link]?.likedByMe ? "currentColor" : "none"}
                />
                <span>{engagement[story.link]?.likes ?? 0}</span>
              </button>

             <button
              type="button"
              className="trending-comments"
              aria-label={`View comments for ${story.title}`}
              onClick={() => {
                setCommentStory(story);
                setCommentText("");
                setEngagementError("");
                void loadEngagement(story);
              }}
              >
                <MessageCircle size={15} />
                <span>{engagement[story.link]?.commentsCount ?? 0}</span>
              </button>
             </div>
            </div>
          ))}
        </div>
      </section>

      {commentStory && (
        <div
          className="news-comment-backdrop"
          onClick={() => setCommentStory(null)}
        >
          <section
            className="news-comment-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Story comments"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="news-comment-close"
              onClick={() => setCommentStory(null)}
              aria-label="Close comments"
            >
              ×
            </button>

            <h2>Fan Comments</h2>
            <p>{displayHeadline(commentStory)}</p>

               {engagementError && (
                <p role="alert" className="news-comment-note">
                  {engagementError}
                </p>
               )}

               {(engagement[commentStory.link]?.comments ?? []).map((comment) => (
                <div key={comment.id} className="news-comment-item">
                 <strong>{comment.author}</strong>
                   <p>{comment.body}</p>
                 <small>{new Date(comment.createdAt).toLocaleString()}</small>
               </div>
                ))}

               {engagement[commentStory.link]?.comments.length === 0 && (
               <p className="news-comment-empty">
                 No comments yet. Start the conversation!
               </p>
              )}

              <form
               onSubmit={(event) => {
                event.preventDefault();
                void postComment();
               }}
              >
              <textarea
               value={commentText}
               onChange={(event) => setCommentText(event.target.value)}
               placeholder="Share your thoughts..."
               maxLength={2000}
               rows={3}
               required
             />

            <button type="submit" disabled={commentLoading || !commentText.trim()}>
              <Send size={15} />
               {commentLoading ? "Posting..." : "Post comment"}
            </button>
           </form>
          </section>
        </div>
      )}

      {validUpdatedAt && (
        <p
          className="news-updated-at"
          style={{
            color: "#666666",
            fontSize: 12,
            marginTop: 20,
            textAlign: "right",
          }}
        >
          News feed last refreshed{" "}
          {new Date(validUpdatedAt).toLocaleString()}
        </p>
      )}
    </main>
  );
}
