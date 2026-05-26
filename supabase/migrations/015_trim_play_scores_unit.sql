-- Trim Play: ranking por unidade (opcional). unit_id NULL = escopo geral da barbearia.

ALTER TABLE trim_play_scores
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES barbershop_units(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_trim_play_scores_unique;

CREATE UNIQUE INDEX IF NOT EXISTS trim_play_scores_shop_client_null_unit
  ON trim_play_scores(barbershop_id, cliente_id)
  WHERE unit_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trim_play_scores_shop_unit_client
  ON trim_play_scores(barbershop_id, unit_id, cliente_id)
  WHERE unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trim_play_scores_shop_unit_best
  ON trim_play_scores(barbershop_id, unit_id, best_score DESC);
