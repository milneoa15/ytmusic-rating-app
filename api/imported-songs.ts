import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

type SongPayload = {
  id: string;
  videoId?: string;
  originalVideoId?: string;
  fallbackVideoId?: string;
  videoAvailabilityStatus?: 'playable' | 'fallback' | 'unavailable';
  videoUnavailableReason?: string;
  videoCheckedAt?: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: string;
  thumbnailUrl?: string;
};

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
  duration_text: string | null;
  thumbnail_url: string | null;
} | null;

type UserSongRow = {
  song_id: string;
  imported_at: string | null;
  metadata: Record<string, any> | null;
  songs?: SongRow;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_songs')
        .select(
          `
            song_id,
            imported_at,
            metadata,
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
              duration_text,
              thumbnail_url
            )
          `
        )
        .eq('user_id', auth.userId)
        .order('imported_at', { ascending: false });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as unknown as UserSongRow[];
      const songs = rows.map(entry => {
        const songRow = entry.songs;
        const metadata = entry.metadata ?? {};
        const primaryVideoId = songRow?.youtube_song_id ?? metadata['videoId'] ?? undefined;
        const fallbackVideoId = songRow?.fallback_youtube_song_id ?? metadata['fallbackVideoId'] ?? undefined;
        const originalVideoId =
          songRow?.original_youtube_song_id ??
          metadata['originalVideoId'] ??
          fallbackVideoId ??
          primaryVideoId ??
          undefined;

        return {
          id: songRow?.id ?? entry.song_id,
          videoId: primaryVideoId,
          originalVideoId,
          fallbackVideoId,
          videoAvailabilityStatus: songRow?.video_availability_status ?? metadata['videoAvailabilityStatus'] ?? undefined,
          videoUnavailableReason: songRow?.video_unavailable_reason ?? metadata['videoUnavailableReason'] ?? undefined,
          videoCheckedAt: songRow?.video_checked_at ?? metadata['videoCheckedAt'] ?? undefined,
          title: songRow?.title ?? metadata['title'] ?? 'Unknown title',
          artist: songRow?.artist ?? metadata['artist'] ?? undefined,
          album: songRow?.album ?? metadata['album'] ?? undefined,
          duration: songRow?.duration_text ?? metadata['duration'] ?? undefined,
          thumbnailUrl: songRow?.thumbnail_url ?? metadata['thumbnailUrl'] ?? undefined,
          importedAt: entry.imported_at
        };
      });

      sendJson(res, 200, { songs });
      return;
    }

    if (req.method === 'POST') {
      const { songs } = normalizeBody<{ songs?: SongPayload[] }>(req);
      if (!Array.isArray(songs) || songs.length === 0) {
        res.status(400).json({ error: 'songs array is required.' });
        return;
      }

      const nowIso = new Date().toISOString();

      for (const song of songs) {
        if (!song.id) {
          continue;
        }

        const songRecord = {
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
        };

        const songResult = await supabase.from('songs').upsert(songRecord, { onConflict: 'id' });
        if (songResult.error) {
          throw songResult.error;
        }

        const userSongRecord: Record<string, any> = {
          user_id: auth.userId,
          song_id: song.id,
          imported_at: nowIso,
          metadata: {
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            thumbnailUrl: song.thumbnailUrl,
            videoId: song.videoId,
            originalVideoId: song.originalVideoId,
            fallbackVideoId: song.fallbackVideoId,
            videoAvailabilityStatus: song.videoAvailabilityStatus,
            videoUnavailableReason: song.videoUnavailableReason,
            videoCheckedAt: song.videoCheckedAt
          }
        };

        const userSongResult = await supabase
          .from('user_songs')
          .upsert(userSongRecord, { onConflict: 'user_id,song_id' });

        if (userSongResult.error) {
          throw userSongResult.error;
        }
      }

      sendJson(res, 200, { success: true, imported: songs.length });
      return;
    }

    if (req.method === 'DELETE') {
      const { songId } = normalizeBody<{ songId?: string }>(req);
      const targetSong = (req.query['songId'] as string) ?? songId;
      if (!targetSong) {
        res.status(400).json({ error: 'songId is required.' });
        return;
      }

      const { error } = await supabase
        .from('user_songs')
        .delete()
        .eq('user_id', auth.userId)
        .eq('song_id', targetSong);

      if (error) {
        throw error;
      }

      sendJson(res, 200, { success: true });
      return;
    }

    methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error: any) {
    console.error('[api/imported-songs] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
