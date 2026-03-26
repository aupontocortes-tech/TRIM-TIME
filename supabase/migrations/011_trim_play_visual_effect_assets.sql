-- SuperADM: múltiplos efeitos visuais por evento para Trim Play
CREATE TABLE IF NOT EXISTS trim_play_visual_effect_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_key TEXT NOT NULL,
  effect_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trim_play_visual_effect_assets_event_enabled_sort
  ON trim_play_visual_effect_assets(event_key, enabled, sort_order);

CREATE TRIGGER trim_play_visual_effect_assets_updated_at
BEFORE UPDATE ON trim_play_visual_effect_assets
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

