-- B2b fallback: photo files stored in D1 as chunks, used when R2 is not enabled on the account.
-- The Worker prefers an R2 bucket whenever the PHOTOS binding exists, and falls back to these tables otherwise, so the
-- app works today and can move to R2 later without any client change.
--
-- A 1.5 MB JPEG becomes ~2 MB of base64, which is far beyond D1's per-row limit, so it is split into fixed-size chunks.
-- Chunk size is chosen so a row stays small enough to be safe (D1 allows far more, but small rows also keep the
-- per-request work bounded).
CREATE TABLE photo_chunks (
  account TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  seq INTEGER NOT NULL, -- 0-based, concatenated in order
  data TEXT NOT NULL, -- base64 slice of the JPEG
  PRIMARY KEY (account, photo_id, seq)
) WITHOUT ROWID;

-- One row per stored photo: lets the limit check and the listing stay a single cheap query instead of a scan.
CREATE TABLE photo_files (
  account TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  bytes INTEGER NOT NULL, -- original byte length, so a download can be verified
  chunks INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account, photo_id)
) WITHOUT ROWID;
