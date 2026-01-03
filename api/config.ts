import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendJson, methodNotAllowed } from './_lib/http';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  // Only public, non-sensitive keys should be exposed here.
  const config = {
    googleClientId: process.env['GOOGLE_CLIENT_ID'],
    redirectUri: process.env['REDIRECT_URI'],
  };

  // Set cache headers to encourage caching of this public config
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate');
  sendJson(res, 200, config);
}
