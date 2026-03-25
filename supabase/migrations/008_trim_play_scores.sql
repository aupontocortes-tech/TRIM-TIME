-- Trim Play mini game scores
-- Top 10 ranking per barbershop, storing only the best score per client.

CREATE TABLE IF NOT EXISTS trim_play_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  cliente_id TEXT NOT NULL,
  cliente_name TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trim_play_scores_unique
  ON trim_play_scores(barbershop_id, cliente_id);

CREATE INDEX IF NOT EXISTS idx_trim_play_scores_barbershop_best
  ON trim_play_scores(barbershop_id, best_score DESC);

-- Keep updated_at fresh
CREATE TRIGGER trim_play_scores_updated_at
BEFORE UPDATE ON trim_play_scores
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

