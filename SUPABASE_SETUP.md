# Supabase & Vercel Setup

This app now persists data in Supabase via Vercel serverless functions. Follow the steps below to finish the integration and keep local development working.

## 1. Prepare Supabase

1. **Create a Supabase project** (or reuse an existing one).
2. Enable the SQL migration in `supabase/migrations/202510220001_initial.sql`. You can apply it with the Supabase SQL editor or via the CLI:
   ```bash
   supabase db push
   ```
3. In the Supabase dashboard, note the following values:
   - Project URL
   - Anonymous public API key
   - Service role key (Server-side usage only)
4. (Optional) Configure database backups and Row Level Security monitoring in Supabase.

## 2. Configure Environment Variables

### Required on Vercel (Project Settings → Environment Variables)

| Key | Example | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | Already required for OAuth. |
| `GOOGLE_CLIENT_SECRET` | secret | Already required. |
| `REDIRECT_URI` | `https://your-app.vercel.app/auth/callback` | Must match OAuth console. |
| `API_BASE_URL` | `/api` | Keep `/api` so front-end calls the same project. |
| `SUPABASE_URL` | `https://xyzcompany.supabase.co` | Project URL from Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | **Serverless functions only.** |
| `GOOGLE_CLIENT_ID` (Serverless) | same value | Required so API can validate access-token audience. |

> The service role key must stay server-side; never expose it to the browser.

### Local Development

1. Copy `src/environments/environment.ts` and fill in:
   ```ts
   apiBaseUrl: '/api'
   remoteStorageEnabled: true
   googleClientId = '<oauth-client-id>'
   googleClientSecret = '<oauth-client-secret>'
   redirectUri = 'http://localhost:4200/auth/callback'
   ```
2. Provide serverless env vars when running Vercel dev or Node functions locally:
   ```bash
   export SUPABASE_URL=...
   export SUPABASE_SERVICE_ROLE_KEY=...
   export API_BASE_URL=/api
   export GOOGLE_CLIENT_ID=...
   ```
3. When running `build-vercel.sh` locally (or during CI) also set `GOOGLE_CLIENT_SECRET` and `REDIRECT_URI` so placeholders are replaced.

## 3. Vercel Deployment Pipeline

1. Ensure the repository build step runs `./build-vercel.sh` instead of `npm run build` directly so the environment files are populated.
2. Deploying preview branches is supported—set per-preview Supabase credentials if you need isolated data (e.g., using a separate Supabase project or schema per environment).
3. Add the following serverless routes (already committed):
   - `/api/library`
   - `/api/imported-songs`
   - `/api/ratings`
   - `/api/themes`
   - `/api/song-themes`
   - `/api/playlists`

## 4. Data Migration from Browser LocalStorage

The Angular `StorageService` now syncs with Supabase automatically. When an authenticated user opens the new build:

1. The service fetches `/api/library` and hydrates browser state.
2. Subsequent local changes enqueue Supabase writes via the API.

If you need to pre-seed historical data, run a one-off script that reads the old localStorage blobs and POSTs to the matching API endpoints while authenticated.

## 5. Testing Checklist

- [ ] `npm run build` succeeds (Angular + serverless TypeScript compilation).
- [ ] With valid environment variables, visit `/library` and confirm songs, ratings, themes, and playlists load after sign-in.
- [ ] Rate a song, create a theme, and create/update/delete playlists—verify changes appear in Supabase tables.
- [ ] Smoke-test `/api/*` routes locally using tools like `curl` with a valid Google access token to ensure auth gating works.

Keep this document with your deployment notes so new collaborators can configure Supabase quickly.
