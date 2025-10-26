import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from '../_lib/http';
import { getServiceSupabaseClient } from '../_lib/supabaseClient';

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
  album?: string;
  duration?: string;
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
    album: song.album,
    duration: song.duration,
    thumbnailUrl: song.thumbnailUrl
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    const body = normalizeBody<BulkRatingsBody>(req);
    const updates = Array.isArray(body.updates) ? body.updates : [];
    const deletes = Array.isArray(body.deletes) ? body.deletes.filter(id => typeof id === 'string' && id.length > 0) : [];

    const normalizedUpdates = updates.map(update => {
      const song = normalizeSongPayload(update);
      const rating = parseRating(update.rating);
      return { song, rating };
    });

    if (normalizedUpdates.length === 0 && deletes.length === 0) {
      sendJson(res, 200, { success: true, updated: 0, deleted: 0 });
      return;
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
        album: song.album ?? null,
        duration_text: song.duration ?? null,
        thumbnail_url: song.thumbnailUrl ?? null
      }));

      const { error: songError } = await supabase.from('songs').upsert(songRecords, { onConflict: 'id' });
      if (songError) {
        throw songError;
      }

      const nowIso = new Date().toISOString();
      const ratingRecords = normalizedUpdates.map(({ song, rating }) => ({
        user_id: auth.userId,
        song_id: song.id,
        rating,
        rated_at: nowIso
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

    sendJson(res, 200, {
      success: true,
      updated: normalizedUpdates.length,
      deleted: deletes.length
    });
  } catch (error: any) {
    console.error('[api/ratings/bulk] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
