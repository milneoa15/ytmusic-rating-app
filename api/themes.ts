import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, normalizeBody, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('themes')
        .select('id, name, color, description, created_at, updated_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const themes = (data ?? []).map(item => ({
        id: item.id,
        userId: auth.userId,
        name: item.name,
        color: item.color,
        description: item.description ?? undefined,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      sendJson(res, 200, { themes });
      return;
    }

    if (req.method === 'POST') {
      const { theme } = normalizeBody<{ theme: { id?: string; name: string; color: string; description?: string } }>(req);
      if (!theme?.name) {
        res.status(400).json({ error: 'Theme name is required.' });
        return;
      }
      if (!theme.color) {
        res.status(400).json({ error: 'Theme color is required.' });
        return;
      }

      const payload = {
        id: theme.id ?? undefined,
        user_id: auth.userId,
        name: theme.name,
        color: theme.color,
        description: theme.description ?? null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('themes')
        .upsert(payload, { onConflict: 'id' })
        .select('id, name, color, description, created_at, updated_at')
        .single();

      if (error || !data) {
        throw error;
      }

      sendJson(res, 200, {
        theme: {
          id: data.id,
          userId: auth.userId,
          name: data.name,
          color: data.color,
          description: data.description ?? undefined,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      const { themeId } = normalizeBody<{ themeId?: string }>(req);
      const id = (req.query['themeId'] as string) ?? themeId;
      if (!id) {
        res.status(400).json({ error: 'themeId is required.' });
        return;
      }

      const { error } = await supabase.from('themes').delete().eq('user_id', auth.userId).eq('id', id);
      if (error) {
        throw error;
      }

      sendJson(res, 200, { success: true });
      return;
    }

    methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error: any) {
    console.error('[api/themes] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
