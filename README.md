# YouTube Music Rating App

A full-featured Angular application for rating, tagging, and curating your personal YouTube Music library. It pairs a rich client experience with Supabase-backed persistence and Vercel serverless functions to keep your data in sync while you explore, review, and re-discover songs.

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Available npm scripts](#available-npm-scripts)
- [Testing & quality checks](#testing--quality-checks)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The YouTube Music Rating App lets you import your favorites, assign granular ratings, organize songs with custom themes, and build intelligent playlists. A mini player driven by the YouTube IFrame API offers continuous playback with queue controls, while Supabase stores your ratings, playlists, and metadata so the experience travels with you across devices.

## Features

- **YouTube OAuth sign-in** – Authenticate with your YouTube account to keep data scoped to your channel.
- **Song library manager** – Import songs, view artwork and metadata, filter by artist or theme, and search instantly.
- **Advanced rating tools** – Assign 0–10 ratings, sort and filter by score, and bias shuffles toward higher-rated tracks.
- **Theming & tagging** – Create color-coded themes and apply them to songs for quick mood- or genre-based filtering.
- **Playlist builder** – Craft playlists with advanced rules (rating ranges, theme/artist filters), star favorites, and edit metadata.
- **Weighted shuffle queue** – Shuffle with optional bias toward your top-rated picks while skipping unavailable videos.
- **Mini player & queue management** – Control playback, reorder the queue via drag-and-drop, cut trailing songs, or jump to specific tracks.
- **Serverless Supabase sync** – Persist library artifacts (songs, ratings, themes, playlists) via Vercel serverless functions and Supabase tables.
- **Offline-friendly caching** – Local storage keeps recent changes and queues pending syncs if a network interruption occurs.

## Architecture

| Layer | Responsibilities |
|-------|------------------|
| **Angular client (`src/app`)** | Standalone components, services, and routing. Uses the YouTube IFrame API for playback, RxJS for state streams, and Angular forms for filtering controls. |
| **State & persistence services** | `MusicPlayerService` coordinates queue state, `StorageService` batches Supabase writes and falls back to local storage when offline, `AuthService` manages the OAuth flow. |
| **Serverless API (`api/`)** | Vercel functions protected by Google Bearer tokens. Endpoints hydrate the client library, sync ratings in bulk, manage playlists, and perform batch imports/cleanup of Supabase rows. |
| **Supabase** | PostgreSQL schema defined by migrations in `supabase/migrations/`. Stores canonical data for users, songs, ratings, themes, playlists, and join tables. |
| **Tooling** | Angular CLI 20 for build/test, Prettier for formatting, Karma/Jasmine for unit tests, Supabase CLI for schema management. |

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or newer (matches Angular CLI 20 requirements)
- npm 10+ (bundled with Node 20)
- [Angular CLI](https://angular.dev/tools/cli) installed globally (`npm install -g @angular/cli`) – optional but convenient
- A Supabase project and the [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations
- A Google Cloud project with a YouTube Data API OAuth 2.0 client (web application type)
- [Vercel CLI](https://vercel.com/docs/cli) if you plan to run serverless functions locally (`npm install -g vercel`)

## Getting started

### 1. Clone and install dependencies

```bash
git clone https://github.com/milneoa15/ytmusic-rating-app.git
cd ytmusic-rating-app
npm install
```

### 2. Configure Angular environments

Create `src/environments/environment.ts` (and optionally update `environment.prod.ts`) with your credentials. Keep secrets out of version control.

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  googleClientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
  redirectUri: 'http://localhost:4200/auth/callback',
  apiBaseUrl: 'http://localhost:3000/api',
  remoteStorageEnabled: true
};
```

When deploying with Vercel, the `build-vercel.sh` script replaces the `__PLACEHOLDER__` tokens in `environment.prod.ts` based on environment variables you configure in the dashboard.

### 3. Configure serverless environment variables

Create an `.env.local` (used by `vercel dev`) in the project root:

```
SUPABASE_URL=your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=super_secret_service_role_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=http://localhost:4200/auth/callback
```

Add any additional variables your Supabase policies expect (for example JWT secrets) and keep the file private.

### 4. Prepare Supabase schema

Use the Supabase CLI to apply the migrations stored in `supabase/migrations/`:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, run `supabase db reset` to recreate the schema locally when using the Supabase Docker stack.

### 5. Run the dev servers

Open two terminals:

```bash
# Terminal 1 – Angular dev server
git checkout main
npm start
```

```bash
# Terminal 2 – Vercel functions
vercel dev
```

Visit `http://localhost:4200` to use the app. API calls will proxy to `http://localhost:3000/api/*` during development based on the `apiBaseUrl` value you configured.

## Available npm scripts

| Script | Description |
|--------|-------------|
| `npm start` | Launches `ng serve` with the development configuration. |
| `npm run build` | Builds a production bundle using Angular CLI. |
| `npm run watch` | Builds in watch mode (useful for integration with tooling). |
| `npm test` | Runs Karma/Jasmine unit tests in watch mode. |

## Testing & quality checks

- **Unit tests:** `npm test`
- **One-off headless test run:** `ng test --watch=false --browsers=ChromeHeadless`
- **Linting & formatting:** Prettier rules live in `package.json`. Run `npx prettier --write "src/**/*.{ts,html,scss}"` to format.

## Project structure

```
ytmusic-rating-app/
├─ api/                     # Vercel serverless functions (library sync, bulk jobs)
├─ src/
│  ├─ app/                  # Angular application source (components, services, models)
│  ├─ environments/         # Angular environment configs
│  ├─ main.ts               # Application bootstrap
│  └─ styles.scss           # Global styling & design tokens
├─ supabase/
│  └─ migrations/           # SQL migrations for the Supabase project
├─ build-vercel.sh          # Helper script for Vercel build-time env injection
├─ angular.json             # Angular workspace configuration
├─ package.json             # Dependencies and npm scripts
└─ README.md                # You are here
```

## Deployment

Deploying to Vercel is the recommended approach:

1. Set the build command to `./build-vercel.sh` so environment placeholders are replaced before `ng build` runs.
2. Define the following environment variables in the Vercel dashboard (for both Build & Runtime):
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `REDIRECT_URI`
  - `API_BASE_URL` (typically `https://<your-app>.vercel.app/api`)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
3. Link your Supabase project to production and ensure row-level security (RLS) policies match the migrations supplied here.
4. Trigger a deployment; Vercel will build the Angular app and ship the functions in `api/` alongside it.

Supabase migrations can be applied in production via the Supabase dashboard or CI using `supabase db push`.

## Troubleshooting

| Symptom | Possible fix |
|---------|--------------|
| OAuth redirect loops back to login | Confirm `redirectUri` in your Angular environment matches the OAuth client configuration exactly (protocol, domain, path). |
| API calls return 401 | Ensure the browser is sending the Bearer token. During local development you must log in so the client can attach the Google access token to `/api/*` requests. |
| "Missing SUPABASE_URL" error from serverless functions | Check the `.env.local` file and Vercel environment settings. All serverless env vars must be defined for both build and runtime. |
| Ratings/themes fail to persist offline | `remoteStorageEnabled` can be toggled in the environment config; if disabled, only local storage is used. Re-enable to sync with Supabase. |
| Karma tests hang | Use `ng test --watch=false --browsers=ChromeHeadless` in CI, and ensure Chrome is installed locally. |

---

Need a hand or have ideas for new features? Open an issue or start a discussion in the repository. Happy rating!
