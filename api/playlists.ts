import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

interface PlaylistPayload {
  id?: string;
  name: string;
  description?: string;
  songIds?: string[];
  filters?: Record<string, unknown>;
  starred?: boolean;
}

async function syncPlaylistSongs(
  playlistId: string,
  userId: string,
  songIds: string[] | undefined
): Promise<void> {
  const supabase = getServiceSupabaseClient();

  await supabase.from('playlist_songs').delete().eq('user_id', userId).eq('playlist_id', playlistId);

  if (!songIds || songIds.length === 0) {
    return;
  }

  const rows = songIds.map((songId, index) => ({
    playlist_id: playlistId,
    song_id: songId,
    user_id: userId,
    position: index,
    added_at: new Date().toISOString()
  }));

  const { error } = await supabase.from('playlist_songs').insert(rows);
  if (error) {
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    if (req.method === 'GET') {
      const playlistId = req.query['playlistId'] as string | undefined;
      let query = supabase
        .from('playlists')
        .select(
          `
            id,
            name,
            description,
            filters,
            starred,
            created_at,
            updated_at,
            playlist_songs:playlist_songs(song_id, position)
          `
        )
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false });

      if (playlistId) {
        query = query.eq('id', playlistId);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const playlists = (data ?? []).map(item => ({
        id: item.id,
        userId: auth.userId,
        name: item.name,
        description: item.description ?? undefined,
        filters: item.filters ?? undefined,
        starred: item.starred ?? false,
        songIds:
          item.playlist_songs
            ?.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .map((entry: any) => entry.song_id) ?? [],
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      sendJson(res, 200, { playlists });
      return;
    }

    if (req.method === 'POST') {
      const { playlist } = normalizeBody<{ playlist?: PlaylistPayload }>(req);
      if (!playlist?.name) {
        res.status(400).json({ error: 'Playlist name is required.' });
        return;
      }

      const payload = {
        id: playlist.id ?? undefined,
        user_id: auth.userId,
        name: playlist.name,
        description: playlist.description ?? null,
        filters: playlist.filters ?? {},
        starred: playlist.starred ?? false,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('playlists')
        .upsert(payload, { onConflict: 'id' })
        .select('id, name, description, filters, starred, created_at, updated_at')
        .single();

      if (error || !data) {
        throw error;
      }

      await syncPlaylistSongs(data.id, auth.userId, playlist.songIds);

      sendJson(res, 200, {
        playlist: {
          id: data.id,
          userId: auth.userId,
          name: data.name,
          description: data.description ?? undefined,
          filters: data.filters ?? undefined,
          starred: data.starred ?? false,
          songIds: playlist.songIds ?? [],
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      const { playlistId } = normalizeBody<{ playlistId?: string }>(req);
      const id = (req.query['playlistId'] as string) ?? playlistId;
      if (!id) {
        res.status(400).json({ error: 'playlistId is required.' });
        return;
      }

      const { error } = await supabase.from('playlists').delete().eq('user_id', auth.userId).eq('id', id);
      if (error) {
        throw error;
      }

      sendJson(res, 200, { success: true });
      return;
    }

    methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error: any) {
    console.error('[api/playlists] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
