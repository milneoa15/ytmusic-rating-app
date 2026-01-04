import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

// From single rating
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
  thumbnail_url: string | null;
} | null;

type RatingRow = {
  song_id: string;
  rating: number | null;
  songs?: SongRow;
};

// From bulk ratings
type SongPayload = {
  id: string;
  videoId?: string;
  originalVideoId?: string;
  fallbackVideoId?: string;
  videoAvailabilityStatus?: string;
  videoUnavailableReason?: string;
  videoCheckedAt?: string;
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
};

type RatingUpdatePayload = {
  song?: SongPayload;
  rating?: number;
};

type BulkRatingsBody = {
  updates?: RatingUpdatePayload[];
  deletes?: string[];
};


// Helper functions
function parseRating(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Rating must be a number.');
  }
  if (value < 1 || value > 10) {
    throw new Error('Rating must be between 1 and 10.');
  }
  return Math.round(value);
}

function normalizeSongPayload(entry: RatingUpdatePayload): SongPayload {
  if (!entry.song || typeof entry.song.id !== 'string') {
    throw new Error('Each rating update must include a song with an id.');
  }

  const song = entry.song;
  return {
    id: song.id,
    videoId: song.videoId,
    originalVideoId: song.originalVideoId ?? song.videoId,
    fallbackVideoId: song.fallbackVideoId,
    videoAvailabilityStatus: song.videoAvailabilityStatus,
    videoUnavailableReason: song.videoUnavailableReason,
    videoCheckedAt: song.videoCheckedAt,
    title: song.title,
    artist: song.artist,
    thumbnailUrl: song.thumbnailUrl
  };
}


export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    // GET (Unaffected)
    if (req.method === 'GET') {
      const { songId, minRating, maxRating } = req.query;
      let query = supabase
        .from('user_songs')
        .select(
          `
            song_id,
            rating,
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
              thumbnailUrl: entry.songs.thumbnail_url ?? undefined
            }
          : null
      }));

      sendJson(res, 200, { ratings: payload });
      return;
    }

    // POST (Combined Logic)
    if (req.method === 'POST') {
      const body = normalizeBody<any>(req);

      // --- BULK LOGIC ---
      if (body.updates || body.deletes) {
        const updates = Array.isArray(body.updates) ? body.updates : [];
        const deletes = Array.isArray(body.deletes) ? body.deletes.filter(id => typeof id === 'string' && id.length > 0) : [];

        const normalizedUpdates = updates.map(update => {
          const song = normalizeSongPayload(update);
          const rating = parseRating(update.rating);
          return { song, rating };
        });

        if (normalizedUpdates.length === 0 && deletes.length === 0) {
          return sendJson(res, 200, { success: true, updated: 0, deleted: 0 });
        }

        if (normalizedUpdates.length > 0) {
          const songRecords = normalizedUpdates.map(({ song }) => ({
            id: song.id,
            youtube_song_id: song.videoId ?? null,
            original_youtube_song_id: song.originalVideoId ?? song.videoId ?? null,
            fallback_youtube_song_id: song.fallbackVideoId ?? null,
            video_availability_status: song.videoAvailabilityStatus ?? null,
            video_unavailable_reason: song.videoUnavailableReason ?? null,
            video_checked_at: song.videoCheckedAt ?? null,
            title: song.title ?? null,
            artist: song.artist ?? null,
            thumbnail_url: song.thumbnailUrl ?? null
          }));

          const { error: songError } = await supabase.from('songs').upsert(songRecords, { onConflict: 'id' });
          if (songError) {
            throw songError;
          }

          const ratingRecords = normalizedUpdates.map(({ song, rating }) => ({
            user_id: auth.userId,
            song_id: song.id,
            rating
          }));

          const { error: ratingError } = await supabase
            .from('user_songs')
            .upsert(ratingRecords, { onConflict: 'user_id,song_id' });

          if (ratingError) {
            throw ratingError;
          }
        }

        if (deletes.length > 0) {
          const { error: deleteError } = await supabase
            .from('user_songs')
            .delete()
            .eq('user_id', auth.userId)
            .in('song_id', deletes);

          if (deleteError) {
            throw deleteError;
          }
        }

        return sendJson(res, 200, {
          success: true,
          updated: normalizedUpdates.length,
          deleted: deletes.length
        });
      }
      
      // --- SINGLE RATING LOGIC ---
      else {
        const { song, rating } = body;
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
              rating: parsedRating
            },
            { onConflict: 'user_id,song_id' }
          );

        if (error) {
          throw error;
        }

        return sendJson(res, 200, { success: true });
      }
    }

    // DELETE (Unaffected)
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