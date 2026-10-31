-- B1: server-side rate limiting for login and register.
-- One row per bucket (see worker/index.ts for how a bucket is chosen), holding the window start and the hit count inside it.
-- D1 has no cron here, so expired rows are simply ignored and overwritten when their window ends.
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY, -- e.g. "register|203.0.113.7" or "login|203.0.113.7"
  window_start INTEGER NOT NULL, -- epoch ms when the current window began
  hits INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX rate_limits_window ON rate_limits (window_start);
