import { createClient, SupabaseClient } from '@supabase/supabase-js';

const cachedClients: Record<string, SupabaseClient> = {};

/**
 * Returns a Supabase client configured with the service role key.
 * Vercel serverless functions will reuse this instance across invocations when possible.
 */
export function getServiceSupabaseClient(): SupabaseClient {
  if (!process.env['SUPABASE_URL']) {
    throw new Error('Missing SUPABASE_URL environment variable.');
  }

  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  const cacheKey = `${process.env['SUPABASE_URL']}:${process.env['SUPABASE_SERVICE_ROLE_KEY']?.slice(0, 8)}`;
  if (!cachedClients[cacheKey]) {
    cachedClients[cacheKey] = createClient(
      process.env['SUPABASE_URL'] as string,
      process.env['SUPABASE_SERVICE_ROLE_KEY'] as string,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return cachedClients[cacheKey];
}
