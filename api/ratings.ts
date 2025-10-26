import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

type SongRow = {
  id: string;
  youtube_song_id: string | null;
  original_youtube_song_id: string | null;
  fallback_youtube_song_id: string | null;
  video_availability_status: string | null;
  video_unavailable_reason: string | null;
  video_checked_at: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration_seconds: number | null;
  duration_text: string | null;
  thumbnail_url: string | null;
} | null;

type RatingRow = {
  song_id: string;
  rating: number | null;
  rated_at: string | null;
  songs?: SongRow;
};

function parseRating(value: unknown): number {
  if (typeof value !== 'number') {
    throw new Error('Rating must be a number.');
  }
  if (value < 1 || value > 10) {
    throw new Error('Rating must be between 1 and 10.');
  }
  return Math.round(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    if (req.method === 'GET') {
      const { songId, minRating, maxRating } = req.query;
      let query = supabase
        .from('user_songs')
        .select(
          `
            song_id,
            rating,
            rated_at,
            songs (
              id,
              youtube_song_id,
              original_youtube_song_id,
              fallback_youtube_song_id,
              video_availability_status,
              video_unavailable_reason,
              video_checked_at,
              title,
              artist,
              album,
              duration_seconds,
              duration_text,
              thumbnail_url
            )
          `
        )
        .eq('user_id', auth.userId);

      if (songId) {
        query = query.eq('song_id', songId as string);
      }
      if (minRating) {
        query = query.gte('rating', Number(minRating));
      }
      if (maxRating) {
        query = query.lte('rating', Number(maxRating));
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const rows = (data ?? []) as unknown as RatingRow[];
      const payload = rows.map(entry => ({
        songId: entry.song_id,
        rating: entry.rating,
        ratedAt: entry.rated_at,
        song: entry.songs
          ? {
              id: entry.songs.id,
              videoId: entry.songs.youtube_song_id ?? undefined,
              originalVideoId: entry.songs.original_youtube_song_id ?? undefined,
              fallbackVideoId: entry.songs.fallback_youtube_song_id ?? undefined,
              videoAvailabilityStatus: entry.songs.video_availability_status ?? undefined,
              videoUnavailableReason: entry.songs.video_unavailable_reason ?? undefined,
              videoCheckedAt: entry.songs.video_checked_at ?? undefined,
              title: entry.songs.title,
              artist: entry.songs.artist,
              album: entry.songs.album ?? undefined,
              duration: entry.songs.duration_text ?? undefined,
              thumbnailUrl: entry.songs.thumbnail_url ?? undefined
            }
          : null
      }));

      sendJson(res, 200, { ratings: payload });
      return;
    }

    if (req.method === 'POST') {
      const { song, rating } = normalizeBody<{ song?: any; rating?: number }>(req);
      if (!song?.id) {
        res.status(400).json({ error: 'song.id is required.' });
        return;
      }

      const parsedRating = parseRating(rating);

      const upsertSong = await supabase.from('songs').upsert(
        {
          id: song.id,
          youtube_song_id: song.videoId ?? null,
          original_youtube_song_id: song.originalVideoId ?? song.videoId ?? null,
          fallback_youtube_song_id: song.fallbackVideoId ?? null,
          video_availability_status: song.videoAvailabilityStatus ?? null,
          video_unavailable_reason: song.videoUnavailableReason ?? null,
          video_checked_at: song.videoCheckedAt ?? null,
          title: song.title,
          artist: song.artist ?? null,
          album: song.album ?? null,
          duration_text: song.duration ?? null,
          thumbnail_url: song.thumbnailUrl ?? null
        },
        { onConflict: 'id' }
      );

      if (upsertSong.error) {
        throw upsertSong.error;
      }

      const { error } = await supabase
        .from('user_songs')
        .upsert(
          {
            user_id: auth.userId,
            song_id: song.id,
            rating: parsedRating,
            rated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,song_id' }
        );

      if (error) {
        throw error;
      }

      sendJson(res, 200, { success: true });
      return;
    }

    if (req.method === 'DELETE') {
      const { songId: bodySongId } = normalizeBody<{ songId?: string }>(req);
      const songId = (req.query['songId'] as string) ?? bodySongId;
      if (!songId) {
        res.status(400).json({ error: 'songId is required.' });
        return;
      }

      const { error } = await supabase
        .from('user_songs')
        .delete()
        .eq('user_id', auth.userId)
        .eq('song_id', songId);

      if (error) {
        throw error;
      }

      res.status(204).end();
      return;
    }

    methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error: any) {
    console.error('[api/ratings] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
