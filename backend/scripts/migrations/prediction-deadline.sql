-- SportyFanz scheduled prediction closing deadline.
-- Existing matches retain NULL; kickoff remains the fallback.
-- Existing predictions and Fan Points remain unchanged.
-- Execute against the development database only.
BEGIN;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS "predictionClosesAt" TIMESTAMPTZ;
COMMIT;
