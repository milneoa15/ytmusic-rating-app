import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

type SongPayload = {
  id: string;
  videoId?: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: string;
  thumbnailUrl?: string;
};

type SongRow = {
  id: string;
  youtube_song_id: string | null;
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
      const songs = rows.map(entry => ({
          id: entry.songs?.id ?? entry.song_id,
          videoId: entry.songs?.youtube_song_id ?? undefined,
          title: entry.songs?.title ?? entry.metadata?.['title'] ?? 'Unknown title',
          artist: entry.songs?.artist ?? entry.metadata?.['artist'] ?? undefined,
          album: entry.songs?.album ?? entry.metadata?.['album'] ?? undefined,
          duration: entry.songs?.duration_text ?? entry.metadata?.['duration'] ?? undefined,
          thumbnailUrl: entry.songs?.thumbnail_url ?? entry.metadata?.['thumbnailUrl'] ?? undefined,
          importedAt: entry.imported_at
        }));

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
            thumbnailUrl: song.thumbnailUrl
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
