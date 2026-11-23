-- Add optional image support to SportyFanz polls.
-- Existing polls remain valid without images.
-- Do not execute until migration approval.

BEGIN;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

COMMIT;
