/** Bucket no Supabase Storage para vídeos de tutoriais (globais, Super ADM). */
export const HELP_TUTORIAL_VIDEO_BUCKET = "help-tutorial-videos"

/** ~150 MB por arquivo — gravações de tela mais longas. */
export const HELP_TUTORIAL_VIDEO_MAX_BYTES = 157_286_400

export const HELP_TUTORIAL_VIDEO_MAX_MB = Math.round(HELP_TUTORIAL_VIDEO_MAX_BYTES / (1024 * 1024))
