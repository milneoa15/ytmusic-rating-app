import { IncomingMessage } from 'http';
import { getServiceSupabaseClient } from './supabaseClient';

export interface AuthenticatedUser {
  userId: string;
  youtubeChannelId: string;
  displayName: string;
  email?: string;
  accessToken: string;
}

function extractBearer(req: IncomingMessage): string {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header) {
    throw new Error('Missing Authorization header.');
  }

  const value = Array.isArray(header) ? header[0] : header;
  if (!value.toLowerCase().startsWith('bearer ')) {
    throw new Error('Authorization header must be a Bearer token.');
  }

  return value.slice(7).trim();
}

async function fetchTokenInfo(accessToken: string): Promise<Record<string, any>> {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );

  if (!response.ok) {
    throw new Error('Failed to validate Google access token.');
  }

  return (await response.json()) as Record<string, any>;
}

async function fetchChannelProfile(accessToken: string): Promise<{ id: string; title: string; email?: string }> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to load YouTube channel profile.');
  }

  const payload = (await response.json()) as any;
  const channel = payload.items?.[0];

  if (!channel) {
    throw new Error('No YouTube channel found for authenticated user.');
  }

  return {
    id: channel.id,
    title: channel.snippet?.title ?? 'YouTube User',
    email: channel.snippet?.customUrl
  };
}

interface SupabaseUserRow {
  id: string;
  youtube_channel_id: string;
  display_name: string | null;
  email: string | null;
}

async function upsertUserRecord(profile: {
  youtubeChannelId: string;
  displayName: string;
  email?: string;
  authUid?: string;
}): Promise<SupabaseUserRow> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        youtube_channel_id: profile.youtubeChannelId,
        display_name: profile.displayName,
        email: profile.email ?? null,
        auth_uid: profile.authUid ?? null
      },
      { onConflict: 'youtube_channel_id' }
    )
    .select('id, youtube_channel_id, display_name, email')
    .single();

  if (error || !data) {
    throw error;
  }

  return data;
}

export async function authenticateRequest(req: IncomingMessage): Promise<AuthenticatedUser> {
  const accessToken = extractBearer(req);
  const info = await fetchTokenInfo(accessToken);

  const expectedClientId = process.env['GOOGLE_CLIENT_ID'];
  if (expectedClientId && info['audience'] && info['audience'] !== expectedClientId) {
    throw new Error('Google access token audience mismatch.');
  }

  const channel = await fetchChannelProfile(accessToken);

  const supabaseUser = await upsertUserRecord({
    youtubeChannelId: channel.id,
    displayName: channel.title,
    email: channel.email,
    authUid: (info['user_id'] as string | undefined) ?? (info['sub'] as string | undefined)
  });

  return {
    userId: supabaseUser.id,
    youtubeChannelId: channel.id,
    displayName: channel.title,
    email: channel.email,
    accessToken
  };
}
