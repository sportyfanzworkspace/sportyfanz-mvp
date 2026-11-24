-- SportyFanz prediction match image support.
-- Adds an optional image URL to existing matches.
-- Existing match records and predictions are preserved.
-- Review before applying to Neon.

BEGIN;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

COMMIT;
