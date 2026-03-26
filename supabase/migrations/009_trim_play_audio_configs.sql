-- SuperADM: configuração de áudios do Trim Play
CREATE TABLE IF NOT EXISTS trim_play_audio_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  file_url TEXT NULL,
  trim_start_ms INTEGER NOT NULL DEFAULT 0,
  trim_end_ms INTEGER NOT NULL DEFAULT 0,
  volume NUMERIC(3,2) NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trim_play_audio_configs_updated_at
BEFORE UPDATE ON trim_play_audio_configs
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
