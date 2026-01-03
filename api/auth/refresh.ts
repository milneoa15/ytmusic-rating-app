import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendJson, methodNotAllowed, normalizeBody } from '../_lib/http';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Refreshes an OAuth access token using a refresh token.
 * This function runs on the server and uses the client secret, which is never exposed to the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const { refreshToken } = normalizeBody<{ refreshToken?: string }>(req);

    if (!refreshToken) {
      return sendJson(res, 400, { error: 'Refresh token is required.' });
    }

    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    } = process.env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('[api/auth/refresh] Missing required environment variables.');
      return sendJson(res, 500, { error: 'Server configuration error.' });
    }

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token refresh with Google failed:', errorData);
      return sendJson(res, response.status, { error: `Token refresh failed: ${(errorData as any).error_description || 'Unknown error'}`});
    }

    const tokenData = await response.json();
    
    // The new token data (access_token, expires_in, and potentially a new refresh_token) is sent to the frontend.
    return sendJson(res, 200, tokenData);

  } catch (error: any) {
    console.error('[api/auth/refresh] error', error);
    return sendJson(res, 500, { error: error.message ?? 'An unexpected error occurred.' });
  }
}
