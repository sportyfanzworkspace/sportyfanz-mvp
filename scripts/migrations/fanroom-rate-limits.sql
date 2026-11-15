-- SportyFanz Fan Room message rate limiting.
-- REVIEW BEFORE EXECUTION.
-- Do not apply to production without approval.

BEGIN;

CREATE TABLE IF NOT EXISTS public.fanroom_rate_limits (
  "senderKey" TEXT PRIMARY KEY,
  "windowStart" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS
  fanroom_rate_limits_expires_idx
ON public.fanroom_rate_limits ("expiresAt");

COMMIT;
