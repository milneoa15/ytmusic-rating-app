import type { VercelRequest, VercelResponse } from '@vercel/node';

export function normalizeBody<T = any>(req: VercelRequest): T {
  if (!req.body) {
    return {} as T;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T;
    } catch (error) {
      throw new Error('Invalid JSON body payload.');
    }
  }
  return req.body as T;
}

export function sendJson(res: VercelResponse, status: number, payload: unknown): void {
  res.status(status).json(payload);
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(','));
  res.status(405).json({ error: 'Method not allowed' });
}
