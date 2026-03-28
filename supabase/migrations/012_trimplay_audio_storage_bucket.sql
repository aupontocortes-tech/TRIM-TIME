-- Trim Play: bucket de áudio no Storage (upload pela API usa service_role).
-- Rode no Supabase → SQL Editor (ou via CLI). Idempotente.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trimplay-audio', 'trimplay-audio', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  allowed_mime_types = NULL;

-- Leitura anónima para o jogo tocar o ficheiro pela URL pública do bucket.
DROP POLICY IF EXISTS "trimplay_audio_public_select" ON storage.objects;

CREATE POLICY "trimplay_audio_public_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trimplay-audio');
