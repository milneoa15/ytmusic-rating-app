# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SonicVault** (formerly YouTube Music Rating App) is an Angular 20+ web application that allows users to import YouTube Music playlists, rate songs from 1-10, organize them with custom themes/categories, and export filtered playlists back to YouTube Music.

## Development Commands

### Development Server
```bash
npm start          # Start dev server at http://localhost:4200
ng serve           # Alternative command
```

### Building
```bash
npm run build      # Production build (uses environment.prod.ts)
ng build --configuration development  # Development build (uses environment.ts)
```

### Testing
```bash
npm test           # Run Karma tests
ng test            # Alternative command
```

### Other Utilities
```bash
ng build --watch --configuration development  # Watch mode for development
```

## Architecture Overview

### Application Type
- **Standalone Component Architecture**: Uses Angular 20+ standalone components (no NgModules)
- **File Naming Convention**: Components use simple names without `.component` suffix (e.g., `login.ts`, `dashboard.ts`)

### Routing Structure
The app has a linear workflow defined in `src/app/app.routes.ts`:

1. `/login` - OAuth authentication with YouTube Music
2. `/auth/callback` - OAuth callback handler (redirects to dashboard)
3. `/dashboard` - Main hub showing stats and navigation
4. `/import` - Select and import playlists from YouTube Music
5. `/library` - View all imported songs, edit ratings and themes
6. `/rating` - Rate songs one-by-one with navigation
7. `/export` - Filter by rating/theme and export as new playlist

### Core Services

#### AuthService (`src/app/services/auth.service.ts`)
- Manages YouTube OAuth 2.0 authentication flow
- Uses environment variables for OAuth credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
- Handles token refresh automatically when tokens expire
- **Mock Mode**: Set `USE_MOCK_AUTH = true` for development without real OAuth
- Stores user session in localStorage with key `currentUser`

#### StorageService (`src/app/services/storage.service.ts`)
Manages all local data using browser localStorage with four main databases:

1. **Ratings Database** (`ytmusic_ratings`): Per-user song ratings (1-10)
2. **Themes Database** (`ytmusic_categories`): User-created themes/categories with colors
3. **Song-Themes Database** (`ytmusic_song_categories`): Many-to-many mapping of songs to themes
4. **Imported Songs Database** (`ytmusic_imported_songs`): Songs imported from playlists

All data is namespaced by userId to support multi-user scenarios.

#### YoutubeMusicService (`src/app/services/youtube-music.service.ts`)
- Integrates with YouTube Data API v3
- Handles pagination automatically when fetching playlist songs (50 items per page)
- Adds songs to playlists sequentially with 200ms delay to avoid rate limiting and 409 conflicts
- **Mock Mode**: Set `USE_MOCK_DATA = true` for development without real API calls
- All API methods use RxJS Observables

#### ModalService (`src/app/services/modal.service.ts`)
- Global confirmation modal service using RxJS Subjects
- Used for delete confirmations and other user prompts

### Data Models

Located in `src/app/models/`:

- **Song**: Core song entity with videoId, title, artist, thumbnailUrl
- **SongRating**: Links song to user with rating (1-10) and timestamp
- **SongWithMetadata**: Extended song with rating and theme IDs for library view
- **Theme**: User-created categories with name and color
- **Playlist**: YouTube playlist with id, title, songCount
- **User**: Authenticated user with OAuth tokens and expiry

### Environment Configuration

**IMPORTANT**: `src/environments/environment.ts` is gitignored and contains sensitive OAuth credentials.

- `environment.ts` - Local development (gitignored, has real credentials)
- `environment.prod.ts` - Production template (committed to git, has placeholders)

The build process uses file replacement to swap environments:
- Development: Uses `environment.ts` as-is
- Production: Replaces `environment.ts` with `environment.prod.ts`

When creating `environment.ts`, use this structure:
```typescript
export const environment = {
  production: false,
  googleClientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  googleClientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'http://localhost:4200/auth/callback'
};
```

### Component Architecture

All components follow this pattern:
- Standalone components with explicit imports
- Separate files: `component-name.ts`, `component-name.html`, `component-name.scss`
- No `.component` in filenames
- Uses OnPush change detection where applicable

**Key Components**:
- `song-library`: Main library view with filtering, sorting, inline rating/theme editing, and song deletion
- `song-rating`: Swipe-style rating interface with keyboard shortcuts and progress tracking
- `playlist-export`: Advanced filtering (by rating ranges and themes) with preview before export
- `confirmation-modal`: Reusable modal component rendered at app root level

### Styling

- Global styles in `src/styles.scss` with CSS custom properties (variables)
- Purple-to-blue gradient theme throughout
- SCSS for component-specific styles
- Responsive design with mobile-first approach
- Prettier configured for 100-character line width

### TypeScript Configuration

**Strict Mode Enabled** - The project uses strict TypeScript settings:
- All strict flags enabled (`strict: true`)
- `noImplicitReturns`, `noFallthroughCasesInSwitch` enforced
- `strictTemplates` for Angular templates
- When adding new code, ensure proper typing and avoid `any` unless absolutely necessary

## Common Development Patterns

### Adding a New Component
```bash
ng generate component components/my-component --standalone
```
Then manually rename files to remove `.component` suffix to match project conventions.

### Working with the YouTube API
- Always check and refresh tokens with `authService.ensureValidToken()` before API calls
- Use the pagination helper in YoutubeMusicService for large playlists
- Handle API errors gracefully with RxJS catchError operators
- Be mindful of YouTube API quota limits

### Modifying Storage Schema
- All storage methods are centralized in StorageService
- When changing data structures, consider migration strategy for existing users
- localStorage has size limits (~5-10MB depending on browser)

### OAuth Flow Testing
1. Set `USE_MOCK_AUTH = false` in AuthService
2. Ensure valid credentials in `environment.ts`
3. Authorized redirect URI must match exactly: `http://localhost:4200/auth/callback`
4. Test the full flow: login → callback → dashboard

## Important Notes

### Security
- **Never commit** `src/environments/environment.ts` - it contains OAuth secrets
- Client secrets should ideally be moved to a backend API (current setup is for development)
- The build script (`package.json`) creates `environment.ts` if missing

### Data Persistence
- All user data stored in browser localStorage
- Clearing browser data will erase all ratings and imported songs
- For production, consider migrating to a backend database

### Testing
- Jasmine + Karma setup included
- Component spec files follow naming: `component-name.spec.ts`
- Run tests before committing changes

### Browser Compatibility
- Targets modern browsers (ES2022)
- Uses zone.js for Angular change detection
- Requires localStorage support

## Current Status

- Core features implemented and functional
- OAuth integration complete (requires valid credentials)
- Real YouTube API integration working
- Mock modes available for development without credentials
- Ready for deployment to Vercel or similar platforms (see DEPLOY_TO_VERCEL.md)
