import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendJson, methodNotAllowed, normalizeBody } from '../_lib/http';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Exchanges an OAuth authorization code for an access token and refresh token.
 * This function runs on the server and uses the client secret, which is never exposed to the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const { code } = normalizeBody<{ code?: string }>(req);

    if (!code) {
      return sendJson(res, 400, { error: 'Authorization code is required.' });
    }

    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    } = process.env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !REDIRECT_URI) {
      console.error('[api/auth/callback] Missing required environment variables.');
      return sendJson(res, 500, { error: 'Server configuration error.' });
    }

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token exchange with Google failed:', errorData);
      return sendJson(res, response.status, { error: `Token exchange failed: ${errorData.error_description || 'Unknown error'}`});
    }

    const tokenData = await response.json();
    
    // The token data (access_token, refresh_token, expires_in) is sent back to the frontend
    // The frontend will then use this to fetch user info and create the user session
    return sendJson(res, 200, tokenData);

  } catch (error: any) {
    console.error('[api/auth/callback] error', error);
    return sendJson(res, 500, { error: error.message ?? 'An unexpected error occurred.' });
  }
}
