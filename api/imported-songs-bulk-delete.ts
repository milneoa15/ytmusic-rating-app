import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

type BulkDeleteBody = {
  songIds?: string[];
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    const body = normalizeBody<BulkDeleteBody>(req);
    const songIds = Array.isArray(body.songIds) ? body.songIds.filter(id => typeof id === 'string' && id.length > 0) : [];

    if (songIds.length === 0) {
      sendJson(res, 200, { success: true, deleted: 0 });
      return;
    }

    const { error } = await supabase
      .from('user_songs')
      .delete()
      .eq('user_id', auth.userId)
      .in('song_id', songIds);

    if (error) {
      throw error;
    }

    sendJson(res, 200, { success: true, deleted: songIds.length });
  } catch (error: any) {
    console.error('[api/imported-songs-bulk-delete] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
