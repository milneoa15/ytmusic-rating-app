import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    if (req.method === 'GET') {
      const songId = req.query['songId'];
      let query = supabase
        .from('song_themes')
        .select('id, song_id, theme_id, created_at')
        .eq('user_id', auth.userId);

      if (songId) {
        query = query.eq('song_id', songId as string);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      sendJson(res, 200, {
        songThemes: (data ?? []).map(item => ({
          id: item.id,
          userId: auth.userId,
          songId: item.song_id,
          themeId: item.theme_id,
          assignedAt: item.created_at
        }))
      });
      return;
    }

    if (req.method === 'POST') {
      const { songId, themeId } = normalizeBody<{ songId?: string; themeId?: string }>(req);
      if (!songId || !themeId) {
        res.status(400).json({ error: 'songId and themeId are required.' });
        return;
      }

      const { data, error } = await supabase
        .from('song_themes')
        .upsert(
          {
            user_id: auth.userId,
            song_id: songId,
            theme_id: themeId
          },
          { onConflict: 'user_id,song_id,theme_id' }
        )
        .select('id, song_id, theme_id, created_at')
        .single();

      if (error || !data) {
        throw error;
      }

      sendJson(res, 200, {
        songTheme: {
          id: data.id,
          userId: auth.userId,
          songId: data.song_id,
          themeId: data.theme_id,
          assignedAt: data.created_at
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      const { songId, themeId } = normalizeBody<{ songId?: string; themeId?: string }>(req);
      const targetSongId = (req.query['songId'] as string) ?? songId;
      const targetThemeId = (req.query['themeId'] as string) ?? themeId;

      if (!targetSongId || !targetThemeId) {
        res.status(400).json({ error: 'songId and themeId are required.' });
        return;
      }

      const { error } = await supabase
        .from('song_themes')
        .delete()
        .eq('user_id', auth.userId)
        .eq('song_id', targetSongId)
        .eq('theme_id', targetThemeId);

      if (error) {
        throw error;
      }

      res.status(204).end();
      return;
    }

    methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error: any) {
    console.error('[api/song-themes] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
