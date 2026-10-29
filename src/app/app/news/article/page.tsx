
"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Heart, Eye, MessageCircle, Send } from "lucide-react";

type NewsStory = {
  id: string;
  title: string;
  seoHeadline?: string;
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
  seoHeadline?: string
  feedSummary?: string;
  articleSummary?: string;
  error?: string;
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
  const [engagement, setEngagement] = useState<Engagement>({
  views: 0,
  likes: 0,
  likedByMe: false,
  commentsCount: 0,
  comments: [],
});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [engagementError, setEngagementError] = useState("");

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
              seoHeadline:
                data.seoHeadline?.trim() || current.seoHeadline || current.title,
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

  // Record a view and load the current engagement for this article.
useEffect(() => {
  if (!story?.link) return;

  let cancelled = false;

  async function loadEngagement() {
    try {
      const viewResponse = await fetch("/api/news/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: story!.link,
          action: "view",
        }),
      });

      // Continue loading engagement even if view recording fails.
      const response = await fetch(
        `/api/news/engagement?url=${encodeURIComponent(story!.link)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load article engagement.");
      }

      if (!cancelled) {
        setEngagement(data);
      }

      if (!viewResponse.ok && viewResponse.status !== 401) {
        console.warn("Unable to record article view.");
      }
    } catch (error) {
      if (!cancelled) {
        setEngagementError(
          error instanceof Error
            ? error.message
            : "Unable to load article engagement."
        );
      }
    }
  }

  void loadEngagement();

  return () => {
    cancelled = true;
  };
}, [story?.link]);

async function toggleLike() {
  if (!story || likeLoading) return;

  setLikeLoading(true);
  setEngagementError("");

  try {
    const response = await fetch("/api/news/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: story.link,
        action: "like",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to update like.");
    }

    setEngagement((current) => ({
      ...current,
      likes: data.likes,
      likedByMe: data.likedByMe,
    }));
  } catch (error) {
    setEngagementError(
      error instanceof Error ? error.message : "Unable to update like."
    );
  } finally {
    setLikeLoading(false);
  }
}

async function submitComment(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!story || !commentText.trim() || commentLoading) return;

  setCommentLoading(true);
  setEngagementError("");

  try {
    const response = await fetch("/api/news/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: story.link,
        action: "comment",
        text: commentText.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to post comment.");
    }

    setCommentText("");

    // Reload counts and comments so both remain in sync.
    const refreshResponse = await fetch(
      `/api/news/engagement?url=${encodeURIComponent(story.link)}`,
      { cache: "no-store" }
    );

    const refreshed = await refreshResponse.json();

    if (!refreshResponse.ok) {
      throw new Error(refreshed.error || "Comment posted, but refresh failed.");
    }

    setEngagement(refreshed);
    setCommentsOpen(true);
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
          {story.seoHeadline?.trim() || story.title}
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

           <div
  className="news-article-engagement"
  style={{
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 20,
    padding: "18px 0",
    marginTop: 12,
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 14,
  }}
>
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: "#666",
    }}
    aria-label={`${engagement.views} views`}
  >
    <Eye size={18} />
    {engagement.views.toLocaleString()} views
  </span>

  <button
    type="button"
    onClick={() => void toggleLike()}
    disabled={likeLoading}
    aria-pressed={engagement.likedByMe}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: 0,
      background: "transparent",
      cursor: likeLoading ? "wait" : "pointer",
      color: engagement.likedByMe ? "#e04455" : "#444",
      font: "inherit",
    }}
  >
    <Heart
      size={18}
      fill={engagement.likedByMe ? "currentColor" : "none"}
    />
    {engagement.likes.toLocaleString()} Likes
  </button>

  <button
    type="button"
    onClick={() => setCommentsOpen((open) => !open)}
    aria-expanded={commentsOpen}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: 0,
      background: "transparent",
      cursor: "pointer",
      color: "#444",
      font: "inherit",
    }}
  >
    <MessageCircle size={18} />
    {engagement.commentsCount.toLocaleString()} Comments
  </button>
</div>

{engagementError && (
  <p role="alert" style={{ color: "#b91c1c", fontSize: 14 }}>
    {engagementError}
  </p>
)}

{commentsOpen && (
  <section
    aria-label="Article comments"
    style={{
      marginTop: 20,
      padding: 18,
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      background: "#fff",
    }}
  >
    <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
      Fan comments
    </h3>

    {engagement.comments.length === 0 ? (
      <p style={{ color: "#666", marginBottom: 16 }}>
        No comments yet. Be the first to share your thoughts.
      </p>
    ) : (
      <div style={{ display: "grid", gap: 16, marginBottom: 20 }}>
        {engagement.comments.map((comment) => (
          <div
            key={comment.id}
            style={{
              paddingBottom: 12,
              borderBottom: "1px solid #eee",
            }}
          >
            <strong>{comment.author}</strong>
            <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
              {comment.body}
            </p>
            <small style={{ color: "#777" }}>
              {new Date(comment.createdAt).toLocaleString()}
            </small>
          </div>
        ))}
      </div>
    )}

    <form onSubmit={submitComment}>
      <textarea
        value={commentText}
        onChange={(event) => setCommentText(event.target.value)}
        placeholder="Share your thoughts about this story..."
        maxLength={2000}
        rows={3}
        required
        style={{
          width: "100%",
          padding: 12,
          border: "1px solid #d1d5db",
          borderRadius: 8,
          resize: "vertical",
          font: "inherit",
          marginBottom: 10,
        }}
      />

      <button
        type="submit"
        disabled={commentLoading || !commentText.trim()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          border: 0,
          borderRadius: 8,
          background: "#f5b82e",
          color: "#111",
          fontWeight: 600,
          cursor: commentLoading ? "wait" : "pointer",
          opacity: commentLoading || !commentText.trim() ? 0.6 : 1,
        }}
      >
        <Send size={16} />
        {commentLoading ? "Posting..." : "Post comment"}
      </button>
    </form>
  </section>
)}
          
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
