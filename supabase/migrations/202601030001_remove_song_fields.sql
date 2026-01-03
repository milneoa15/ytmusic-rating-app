-- Drop unused columns from the songs table
ALTER TABLE public.songs DROP COLUMN IF EXISTS album;
ALTER TABLE public.songs DROP COLUMN IF EXISTS duration_seconds;
ALTER TABLE public.songs DROP COLUMN IF EXISTS duration_text;
ALTER TABLE public.songs DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.songs DROP COLUMN IF EXISTS created_at;

-- Drop the updated_at column and its associated trigger
DROP TRIGGER IF EXISTS touch_songs_updated_at ON public.songs;
ALTER TABLE public.songs DROP COLUMN IF EXISTS updated_at;
