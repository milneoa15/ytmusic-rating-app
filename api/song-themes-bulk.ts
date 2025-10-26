import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

type AssignmentPayload = {
  songId?: string;
  themeId?: string;
};

type BulkSongThemesBody = {
  assignments?: AssignmentPayload[];
  removals?: AssignmentPayload[];
};

function sanitizePair(entry: AssignmentPayload): { songId: string; themeId: string } {
  if (!entry.songId || !entry.themeId) {
    throw new Error('songId and themeId are required for each entry.');
  }
  return { songId: entry.songId, themeId: entry.themeId };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    const body = normalizeBody<BulkSongThemesBody>(req);
    const assignmentsRaw = Array.isArray(body.assignments) ? body.assignments : [];
    const removalsRaw = Array.isArray(body.removals) ? body.removals : [];

    const assignments = assignmentsRaw.map(sanitizePair);
    const removals = removalsRaw.map(sanitizePair);

    if (assignments.length === 0 && removals.length === 0) {
      sendJson(res, 200, { success: true, assigned: 0, removed: 0 });
      return;
    }

    if (assignments.length > 0) {
      const records = assignments.map(pair => ({
        user_id: auth.userId,
        song_id: pair.songId,
        theme_id: pair.themeId
      }));

      const { error: assignError } = await supabase
        .from('song_themes')
        .upsert(records, { onConflict: 'user_id,song_id,theme_id' });

      if (assignError) {
        throw assignError;
      }
    }

    if (removals.length > 0) {
      const grouped = removals.reduce<Record<string, Set<string>>>((acc, pair) => {
        if (!acc[pair.songId]) {
          acc[pair.songId] = new Set();
        }
        acc[pair.songId].add(pair.themeId);
        return acc;
      }, {});

      for (const [songId, themeIds] of Object.entries(grouped)) {
        if (themeIds.size === 0) {
          continue;
        }

        const { error: deleteError } = await supabase
          .from('song_themes')
          .delete()
          .eq('user_id', auth.userId)
          .eq('song_id', songId)
          .in('theme_id', Array.from(themeIds));

        if (deleteError) {
          throw deleteError;
        }
      }
    }

    sendJson(res, 200, {
      success: true,
      assigned: assignments.length,
      removed: removals.length
    });
  } catch (error: any) {
    console.error('[api/song-themes-bulk] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
