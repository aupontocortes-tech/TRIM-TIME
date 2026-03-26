-- SuperADM: múltiplos áudios por categoria para Trim Play
CREATE TABLE IF NOT EXISTS trim_play_audio_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  trim_start_sec NUMERIC(6,3) NOT NULL DEFAULT 0,
  trim_end_sec NUMERIC(6,3) NOT NULL DEFAULT 2,
  volume NUMERIC(3,2) NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trim_play_audio_assets_category
  ON trim_play_audio_assets(category, enabled, sort_order);

CREATE TRIGGER trim_play_audio_assets_updated_at
BEFORE UPDATE ON trim_play_audio_assets
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
