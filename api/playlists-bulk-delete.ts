import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

type BulkPlaylistDeleteBody = {
  playlistIds?: string[];
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    const body = normalizeBody<BulkPlaylistDeleteBody>(req);
    const playlistIds = Array.isArray(body.playlistIds)
      ? body.playlistIds.filter(id => typeof id === 'string' && id.length > 0)
      : [];

    if (playlistIds.length === 0) {
      sendJson(res, 200, { success: true, deleted: 0 });
      return;
    }

    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('user_id', auth.userId)
      .in('id', playlistIds);

    if (error) {
      throw error;
    }

    sendJson(res, 200, { success: true, deleted: playlistIds.length });
  } catch (error: any) {
    console.error('[api/playlists-bulk-delete] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
