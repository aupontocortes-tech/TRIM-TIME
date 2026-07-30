-- Tutoriais: bucket de vídeo no Storage (upload direto pelo Super ADM).
-- Rode no Supabase → SQL Editor (ou via CLI). Idempotente.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('help-tutorial-videos', 'help-tutorial-videos', true, 157286400, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 157286400,
  allowed_mime_types = NULL;

DROP POLICY IF EXISTS "help_tutorial_videos_public_select" ON storage.objects;

CREATE POLICY "help_tutorial_videos_public_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'help-tutorial-videos');
