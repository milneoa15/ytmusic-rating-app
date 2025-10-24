# Supabase Migration & Vercel Deployment Plan

## Goals
- Replace browser local storage with Supabase Postgres so user data persists across sessions and devices.
- Preserve the existing YouTube OAuth flow while securing database reads/writes behind trusted services.
- Keep the GitHub -> Vercel deployment pipeline, adding Supabase configuration with minimal downtime.

## Phase 0 ? Preparation
1. Confirm Supabase project is created and note the project URL, anon key, and service role key.
2. Decide on environments (e.g., `development`, `staging`, `production`) and whether each maps to a separate Supabase project or separate schemas.
3. Audit current data models in `src/app/models` and the `StorageService` methods to understand all persisted entities and relationships.
4. Create an issue list in GitHub (or your tracker) for each migration phase so progress can be tracked alongside code changes.

## Phase 1 ? Supabase Schema & Security
1. In Supabase, create tables that mirror the local models:
   - `users` (id, youtube_channel_id, display_name, email, refresh_token, token_expires_at, created_at, updated_at).
   - `songs` (id, title, artist, album, duration, youtube_video_id, created_at, updated_at).
   - `user_songs` for ratings/imported songs (id, user_id FK, song_id FK, rating, rated_at, metadata JSONB).
   - `themes` (id, user_id FK, name, color, description, created_at, updated_at).
   - `song_themes` (id, user_id FK, song_id FK, theme_id FK).
   - `playlists` (id, user_id FK, name, description, filters JSONB, starred, created_at, updated_at).
   - `playlist_songs` (id, playlist_id FK, song_id FK, position INT, added_at).
2. Use Supabase migration SQL (via the dashboard or `supabase db push`) so schema changes are versioned alongside code.
3. Enable Row Level Security on every user-owned table.
4. Create policies that only allow access when `auth.uid() = user_id`. For service actions (such as admin scripts), plan to use the service role key from a secure backend only.
5. If keeping YouTube OAuth separate from Supabase Auth, create a `profiles` view keyed by `auth.uid()` that joins to `users` so policies can map to your custom user identifiers.

## Phase 2 ? Secure Backend Adapter
1. Add a lightweight Node runtime in the repo (e.g., `/api` directory with Vercel serverless functions or a small Express server if you later move to Vercel serverless functions) to act as a trusted layer between the Angular client and Supabase.
2. Implement endpoints such as `/api/ratings`, `/api/themes`, `/api/playlists`, handling CRUD operations by calling Supabase using the service role key.
3. Enforce authorization in this layer:
   - Validate the requester via the existing YouTube OAuth token (call Google token info endpoint) or signed JWT stored in Supabase Auth.
   - Map the validated identity to a `users` row (create it on first request if missing).
4. Store Supabase service role key and any Google client secrets as server-side environment variables only.
5. Add integration tests (can run locally with `supabase start`) to cover the critical endpoints.

## Phase 3 ? Angular Client Updates
1. Replace `StorageService` with a data layer that talks to the new API endpoints:
   - Create a `SupabaseDataService` (or generic `ApiDataService`) using Angular `HttpClient`.
   - Adjust existing components (`song-library`, `playlist-manager`, etc.) to call the new service asynchronously, handling loading and error states.
   - Remove direct `localStorage` reads/writes once parity is achieved.
2. Update `environment.ts` / `environment.prod.ts` to include:
   - `apiBaseUrl` for the Vercel serverless endpoints.
   - (Optional) Supabase anon details if you decide to expose limited read operations directly.
3. Add retry/error handling and optimistic updates where appropriate so UX remains smooth.
4. Update unit tests and add integration tests that mock the new API responses.

## Phase 4 ? Data Migration
1. Build a one-time migration script (Node/TS) that reads existing localStorage blobs and posts them to the new API.
   - Offer this as an in-app "Import my local data" UX for end users.
   - Alternatively, create an admin-only CLI that uses Supabase service role key to seed data for specific users during rollout.
2. Provide clear messaging in the UI prompting users to sync before the new release if they want to preserve existing data.
3. After migration, disable or hide the legacy localStorage pathways.

## Phase 5 ? Vercel Deployment Updates
1. In Vercel project settings, add environment variables for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), and any API secrets required for Google OAuth.
2. Update the build command if needed (`npm run build` should continue to emit the Angular dist bundle; ensure serverless API functions are bundled by Vercel).
3. For preview deployments, supply Supabase preview credentials (either a separate Supabase project or isolated schema).
4. Add a GitHub Actions or Vercel build hook step that runs `supabase db push` (or your migration tooling) before the front-end deploy when schema changes are introduced.

## Phase 6 ? Verification & Monitoring
1. Smoke-test preview builds: log in, import data, create/update ratings, playlists, and ensure nothing falls back to localStorage.
2. Enable Supabase logs to monitor RLS denials and slow queries; configure alerts for error rates.
3. Set up Vercel Analytics or Supabase Observability to watch API latencies.
4. Plan a rollback path: keep localStorage code on a feature flag for one release in case Supabase issues arise.

## Phase 7 ? Post-Launch Tasks
1. Document new environment variables and onboarding steps in `PROJECT_README.md` or a dedicated `docs/supabase.md`.
2. Schedule periodic database backups from Supabase and add retention policies.
3. Review cost and performance after the first month and adjust Supabase or Vercel plans as needed.
