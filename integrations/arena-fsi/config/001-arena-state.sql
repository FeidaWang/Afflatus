-- Additive: never alters or drops the host's existing ledger/data tables.
CREATE TABLE IF NOT EXISTS arena_state (
  id text PRIMARY KEY,
  version bigint NOT NULL CHECK (version > 0),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
