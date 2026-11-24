-- SportyFanz administrative prediction closure.
-- Allows prediction submissions to be closed independently
-- of the sporting match status.
-- Existing matches, predictions, and Fan Points are preserved.
-- REVIEW BEFORE EXECUTION.

BEGIN;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS "predictionsClosedAt" TIMESTAMPTZ;

COMMIT;
