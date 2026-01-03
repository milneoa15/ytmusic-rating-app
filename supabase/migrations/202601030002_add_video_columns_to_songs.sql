ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS original_youtube_song_id TEXT,
ADD COLUMN IF NOT EXISTS fallback_youtube_song_id TEXT,
ADD COLUMN IF NOT EXISTS video_availability_status TEXT,
ADD COLUMN IF NOT EXISTS video_unavailable_reason TEXT,
ADD COLUMN IF NOT EXISTS video_checked_at TIMESTAMPTZ;
