-- SportyFanz guest news engagement
-- Review before applying to Neon.
-- Existing registered-user data is preserved.

BEGIN;

-- Speed up guest article-view lookups.
CREATE INDEX IF NOT EXISTS
  news_views_article_visitor_key_idx
ON public.news_views ("articleUrl", "visitorKey");

-- Allow news comments from registered fans or guests.
ALTER TABLE public.news_comments
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE public.news_comments
  ADD COLUMN IF NOT EXISTS "guestTokenHash" TEXT;

ALTER TABLE public.news_comments
  ADD COLUMN IF NOT EXISTS "guestName" TEXT;

CREATE INDEX IF NOT EXISTS
  news_comments_article_guest_token_idx
ON public.news_comments ("articleUrl", "guestTokenHash");

-- Allow article likes from registered fans or guests.
ALTER TABLE public.news_article_likes
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE public.news_article_likes
  ADD COLUMN IF NOT EXISTS "guestTokenHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS
  news_article_likes_article_guest_token_key
ON public.news_article_likes ("articleUrl", "guestTokenHash");


-- Every comment must belong to exactly one author type.
-- Guest comments must include a nonblank display name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.news_comments'::regclass
      AND conname = 'news_comments_author_check'
  ) THEN
    ALTER TABLE public.news_comments
      ADD CONSTRAINT news_comments_author_check
      CHECK (
    (
      "userId" IS NOT NULL
      AND "guestTokenHash" IS NULL
      AND "guestName" IS NULL
    )
    OR
    (
      "userId" IS NULL
      AND "guestTokenHash" IS NOT NULL
      AND length("guestTokenHash") = 64
      AND "guestName" IS NOT NULL
      AND length(btrim("guestName")) BETWEEN 2 AND 40
    )
  );
  END IF;
END
$$;

-- Every article like must belong to a registered fan or guest.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.news_article_likes'::regclass
      AND conname = 'news_article_likes_author_check'
  ) THEN
    ALTER TABLE public.news_article_likes
      ADD CONSTRAINT news_article_likes_author_check
      CHECK (
    (
      "userId" IS NOT NULL
      AND "guestTokenHash" IS NULL
    )
    OR
    (
      "userId" IS NULL
      AND "guestTokenHash" IS NOT NULL
      AND length("guestTokenHash") = 64
    )
  );
  END IF;
END
$$;

COMMIT;
