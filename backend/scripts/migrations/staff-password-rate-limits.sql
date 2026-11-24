-- SportyFanz staff password setup rate limiting.
-- REVIEW BEFORE EXECUTION.
-- Do not apply to production without approval.

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_password_rate_limits (
  "identifierHash" TEXT PRIMARY KEY,
  "windowStart" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS
  staff_password_rate_limits_expires_idx
ON public.staff_password_rate_limits ("expiresAt");

COMMIT;
