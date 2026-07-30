/** Bucket no Supabase Storage para vídeos de tutoriais (globais, Super ADM). */
export const HELP_TUTORIAL_VIDEO_BUCKET = "help-tutorial-videos"

/** ~80 MB por arquivo — suficiente para gravações de tela de alguns minutos. */
export const HELP_TUTORIAL_VIDEO_MAX_BYTES = 83_886_080

export const HELP_TUTORIAL_VIDEO_MAX_MB = Math.round(HELP_TUTORIAL_VIDEO_MAX_BYTES / (1024 * 1024))
