# Database Migration Plan: localStorage → Real Database

## Executive Summary

This document outlines a comprehensive plan to migrate **SonicVault** from browser localStorage to a proper database backend. The migration will improve data persistence, enable multi-device sync, remove storage limitations, and enhance security by moving OAuth credentials server-side.

**Recommended Stack:**
- **Database**: Vercel Postgres (neon) - serverless PostgreSQL
- **Backend**: Next.js API Routes (deployed on Vercel alongside frontend)
- **ORM**: Prisma (type-safe database client)
- **Alternative Deployment**: Keep Vercel (fully compatible)

---

## 1. Current Architecture Analysis

### Current Data Storage (localStorage)

| Database Key | Data Stored | Current Size Limit |
|--------------|-------------|-------------------|
| `ytmusic_ratings` | Song ratings (1-10) per user | ~5-10MB total |
| `ytmusic_categories` | User-created themes | ~5-10MB total |
| `ytmusic_song_categories` | Song-to-theme mappings | ~5-10MB total |
| `ytmusic_imported_songs` | Imported song metadata | ~5-10MB total |
| `currentUser` | OAuth tokens & user session | ~5-10MB total |

### Current Limitations
1. **Data Loss Risk**: Clearing browser data deletes everything
2. **No Multi-Device Sync**: Ratings tied to single browser
3. **Size Constraints**: localStorage limited to 5-10MB
4. **Security**: OAuth tokens exposed in browser
5. **No Collaboration**: Can't share playlists/ratings
6. **Performance**: Large datasets slow down localStorage operations

---

## 2. Proposed Architecture

### Technology Stack

#### Database: Vercel Postgres (Recommended)
**Why Vercel Postgres:**
- ✅ Seamless Vercel integration (zero-config)
- ✅ Serverless PostgreSQL (powered by Neon)
- ✅ Generous free tier (256MB storage, 60 hours compute/month)
- ✅ Automatic connection pooling
- ✅ No cold starts for database connections
- ✅ Built-in backups and scaling

**Alternative Options:**
- **Supabase**: Postgres + realtime + auth (generous free tier, 500MB)
- **PlanetScale**: Serverless MySQL (good free tier, branching workflow)
- **MongoDB Atlas**: NoSQL option (512MB free tier)
- **Railway**: Postgres with better free tier (1GB storage, $5 credit/month)

#### Backend Framework: Next.js API Routes
**Why Next.js:**
- ✅ Already compatible with Angular (separate apps in monorepo OR standalone API)
- ✅ Native Vercel support with zero config
- ✅ Serverless functions (cost-effective)
- ✅ TypeScript support
- ✅ Edge runtime option for faster responses
- ✅ Can coexist with Angular app on Vercel

**Deployment Options:**
1. **Option A (Recommended)**: Separate Next.js API deployed to Vercel subdomain
   - `app.sonicvault.com` → Angular frontend
   - `api.sonicvault.com` → Next.js backend

2. **Option B**: Monorepo with Angular + Next.js API
   - Single Vercel project
   - API routes at `/api/*`
   - Angular app at root

3. **Option C**: Keep Angular, add Express.js API
   - Deploy Express to Vercel as serverless functions
   - More manual setup but familiar to Node.js devs

#### ORM: Prisma
**Why Prisma:**
- ✅ Type-safe database queries (auto-generated TypeScript types)
- ✅ Excellent PostgreSQL support
- ✅ Built-in migration system
- ✅ Intuitive schema definition
- ✅ Great dev experience with Prisma Studio (GUI)

---

## 3. Database Schema Design

### PostgreSQL Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// User & Authentication
// ============================================

model User {
  id                String    @id @default(uuid())
  email             String    @unique
  googleId          String    @unique
  displayName       String?
  profilePicture    String?

  // OAuth tokens (encrypted at rest)
  accessToken       String    @db.Text
  refreshToken      String    @db.Text
  tokenExpiry       DateTime

  createdAt         DateTime  @default(now())
  lastLogin         DateTime  @default(now())

  // Relationships
  ratings           Rating[]
  themes            Theme[]
  importedSongs     ImportedSong[]
  songThemes        SongTheme[]
  exportHistory     ExportHistory[]

  @@index([email])
  @@index([googleId])
}

// ============================================
// Songs & Ratings
// ============================================

model Song {
  id            String    @id @default(uuid())
  videoId       String    @unique  // YouTube video ID
  title         String
  artist        String
  thumbnailUrl  String?
  duration      Int?      // Duration in seconds

  createdAt     DateTime  @default(now())

  // Relationships
  ratings       Rating[]
  imports       ImportedSong[]
  songThemes    SongTheme[]

  @@index([videoId])
  @@index([title])
}

model Rating {
  id          String    @id @default(uuid())
  userId      String
  songId      String
  rating      Int       // 1-10

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relationships
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  song        Song      @relation(fields: [songId], references: [id], onDelete: Cascade)

  // Unique constraint: one rating per user per song
  @@unique([userId, songId])
  @@index([userId])
  @@index([songId])
  @@index([rating])
}

// ============================================
// Themes/Categories
// ============================================

model Theme {
  id          String    @id @default(uuid())
  userId      String
  name        String
  color       String    // Hex color code

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relationships
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  songThemes  SongTheme[]

  @@unique([userId, name]) // Theme names unique per user
  @@index([userId])
}

model SongTheme {
  id          String    @id @default(uuid())
  userId      String
  songId      String
  themeId     String

  createdAt   DateTime  @default(now())

  // Relationships
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  song        Song      @relation(fields: [songId], references: [id], onDelete: Cascade)
  theme       Theme     @relation(fields: [themeId], references: [id], onDelete: Cascade)

  @@unique([userId, songId, themeId]) // Prevent duplicate assignments
  @@index([userId])
  @@index([songId])
  @@index([themeId])
}

// ============================================
// Import Tracking
// ============================================

model ImportedSong {
  id              String    @id @default(uuid())
  userId          String
  songId          String
  sourcePlaylist  String    // YouTube playlist ID
  importedAt      DateTime  @default(now())

  // Relationships
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  song            Song      @relation(fields: [songId], references: [id], onDelete: Cascade)

  @@unique([userId, songId, sourcePlaylist])
  @@index([userId])
  @@index([songId])
}

// ============================================
// Export History (New Feature)
// ============================================

model ExportHistory {
  id                String    @id @default(uuid())
  userId            String
  playlistId        String    // YouTube playlist ID created
  playlistName      String
  songCount         Int

  // Export filters used
  minRating         Int?
  maxRating         Int?
  themeIds          String[]  // JSON array of theme IDs

  exportedAt        DateTime  @default(now())

  // Relationships
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([exportedAt])
}
```

### Migration from localStorage Data Structure

| localStorage Key | Database Table(s) | Notes |
|------------------|-------------------|-------|
| `currentUser` | `User` | OAuth tokens encrypted, add more user fields |
| `ytmusic_ratings` | `Rating` + `Song` | Extract songs, normalize ratings |
| `ytmusic_categories` | `Theme` | Direct mapping, add user relation |
| `ytmusic_song_categories` | `SongTheme` | Direct mapping with foreign keys |
| `ytmusic_imported_songs` | `ImportedSong` + `Song` | Track import source, deduplicate songs |

---

## 4. Backend API Design

### API Architecture (Next.js API Routes)

```
/api
├── /auth
│   ├── /google              POST   - Initiate OAuth flow
│   ├── /callback            GET    - OAuth callback handler
│   ├── /refresh             POST   - Refresh access token
│   ├── /logout              POST   - Logout user
│   └── /me                  GET    - Get current user
│
├── /songs
│   ├── /                    GET    - List all songs (with filters)
│   ├── /:songId             GET    - Get single song with ratings/themes
│   └── /search              GET    - Search songs by title/artist
│
├── /ratings
│   ├── /                    GET    - Get all ratings for current user
│   ├── /                    POST   - Create/update rating
│   ├── /:ratingId           PUT    - Update rating
│   ├── /:ratingId           DELETE - Delete rating
│   └── /bulk                POST   - Bulk create/update ratings
│
├── /themes
│   ├── /                    GET    - Get all themes for current user
│   ├── /                    POST   - Create theme
│   ├── /:themeId            PUT    - Update theme
│   ├── /:themeId            DELETE - Delete theme
│   └── /:themeId/songs      GET    - Get songs for theme
│
├── /song-themes
│   ├── /                    POST   - Assign theme to song
│   ├── /                    DELETE - Remove theme from song
│   └── /bulk                POST   - Bulk assign/remove
│
├── /import
│   ├── /playlists           GET    - List user's YT playlists
│   ├── /playlists/:id       GET    - Get playlist songs
│   └── /                    POST   - Import songs from playlist
│
├── /export
│   ├── /preview             POST   - Preview export (filter results)
│   └── /                    POST   - Create YT playlist from filters
│
└── /library
    └── /                    GET    - Get all songs with ratings/themes
```

### Authentication Flow

1. **Frontend**: User clicks "Login with Google"
2. **API**: `POST /api/auth/google` returns OAuth URL
3. **Browser**: Redirect to Google OAuth consent screen
4. **Google**: Redirect to `GET /api/auth/callback?code=...`
5. **API**: Exchange code for tokens, create user, return JWT
6. **Frontend**: Store JWT in httpOnly cookie (secure)
7. **Subsequent requests**: JWT sent automatically, verified in middleware

### Security Features

1. **JWT Authentication**:
   - Short-lived access tokens (15 min)
   - Refresh tokens (7 days) stored in httpOnly cookies

2. **Token Encryption**:
   - YouTube OAuth tokens encrypted at rest in database
   - Use `crypto` module with AES-256-GCM

3. **CORS Configuration**:
   - Whitelist only production domain

4. **Rate Limiting**:
   - Implement rate limiting on API routes (100 req/min per user)

5. **Input Validation**:
   - Use Zod for request body validation

---

## 5. Frontend Changes Required

### Update Angular Services

#### 1. Create New API Client Service

```typescript
// src/app/services/api.service.ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl; // https://api.sonicvault.com

  constructor(private http: HttpClient) {}

  // Automatic JWT handling via httpOnly cookies
  get<T>(endpoint: string, options?: any): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, {
      ...options,
      withCredentials: true // Send cookies
    });
  }

  post<T>(endpoint: string, body: any, options?: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, {
      ...options,
      withCredentials: true
    });
  }

  // ... put, delete methods
}
```

#### 2. Update AuthService

```typescript
// src/app/services/auth.service.ts - Changes
export class AuthService {
  - Remove localStorage token management
  + Call API for login: apiService.post('/auth/google')
  + Call API for logout: apiService.post('/auth/logout')
  + Call API for user info: apiService.get('/auth/me')
  - Remove client-side token refresh logic (handled by API)
}
```

#### 3. Update StorageService → DatabaseService

```typescript
// src/app/services/database.service.ts (rename from storage.service.ts)
export class DatabaseService {
  - Remove all localStorage logic
  + getRatings(): Observable<Rating[]> → apiService.get('/ratings')
  + saveRating(rating): Observable<Rating> → apiService.post('/ratings', rating)
  + getThemes(): Observable<Theme[]> → apiService.get('/themes')
  + getSongsWithMetadata(): Observable<SongWithMetadata[]> → apiService.get('/library')
  // ... all methods now call API
}
```

#### 4. Update YoutubeMusicService

```typescript
// src/app/services/youtube-music.service.ts - Changes
export class YoutubeMusicService {
  - Remove direct YouTube API calls from frontend
  + getPlaylists(): Observable<Playlist[]> → apiService.get('/import/playlists')
  + importPlaylist(id): Observable<Song[]> → apiService.post('/import', { playlistId: id })
  + exportPlaylist(filters): Observable<string> → apiService.post('/export', filters)
  // Backend makes YouTube API calls with server-stored tokens
}
```

#### 5. Update Components

**Minimal changes required** - services return Observables, so components just need:
- Handle loading states (API calls take longer than localStorage)
- Add error handling for network failures
- Add retry logic for failed requests

### Add HTTP Interceptor for Error Handling

```typescript
// src/app/interceptors/auth.interceptor.ts
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Redirect to login
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}
```

---

## 6. Migration Strategy for Existing Users

### Option A: One-Time Export/Import Tool

**For users who have data in localStorage:**

1. **Before Migration**:
   - Add "Export My Data" button in app
   - Downloads JSON file with all localStorage data

2. **After Migration**:
   - Add "Import Old Data" button on first login
   - Upload JSON file to API endpoint
   - API parses and inserts into database

**Implementation:**
```typescript
// Frontend: Export localStorage to JSON
exportLocalData(): void {
  const data = {
    ratings: JSON.parse(localStorage.getItem('ytmusic_ratings') || '{}'),
    themes: JSON.parse(localStorage.getItem('ytmusic_categories') || '{}'),
    songThemes: JSON.parse(localStorage.getItem('ytmusic_song_categories') || '{}'),
    songs: JSON.parse(localStorage.getItem('ytmusic_imported_songs') || '{}')
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sonicvault-backup-${Date.now()}.json`;
  a.click();
}

// Backend: Import endpoint
POST /api/migration/import
- Validate JSON structure
- Create songs, ratings, themes in database
- Handle duplicates gracefully
```

### Option B: Automatic Cloud Sync (Advanced)

**Automatically sync localStorage to cloud on migration:**

1. User logs in for first time (after migration deployed)
2. Frontend detects localStorage data exists
3. Shows modal: "Sync your data to cloud? (Enables multi-device access)"
4. If accepted, POST to `/api/migration/auto-sync`
5. API imports all data, marks user as "migrated"
6. Clear localStorage after successful sync

---

## 7. Implementation Roadmap

### Phase 1: Backend Setup (Week 1-2)

#### Step 1: Create Next.js API Project
```bash
# Option A: Standalone API
npx create-next-app@latest sonicvault-api --typescript --app-router
cd sonicvault-api

# Option B: Monorepo (if combining with Angular)
mkdir sonicvault-monorepo
cd sonicvault-monorepo
# Move Angular app to /frontend
# Create /backend for Next.js API
```

#### Step 2: Setup Vercel Postgres
```bash
# Install Vercel CLI
npm i -g vercel

# Login and link project
vercel login
vercel link

# Create Postgres database
vercel postgres create sonicvault-db

# This creates DATABASE_URL in .env.local automatically
```

#### Step 3: Setup Prisma
```bash
npm install prisma @prisma/client
npx prisma init

# Copy schema from section 3 above to prisma/schema.prisma

# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view DB
npx prisma studio
```

#### Step 4: Implement Core API Routes
- [ ] Auth routes (`/api/auth/*`)
- [ ] Rating routes (`/api/ratings/*`)
- [ ] Theme routes (`/api/themes/*`)
- [ ] Library route (`/api/library`)

#### Step 5: Test API with Postman/Thunder Client
- [ ] Create test user
- [ ] Create ratings
- [ ] Verify JWT authentication works

### Phase 2: YouTube API Integration (Week 2-3)

#### Step 6: Move YouTube API Calls to Backend
- [ ] Implement `/api/import/*` routes
- [ ] Implement `/api/export/*` routes
- [ ] Use user's stored OAuth tokens for API calls
- [ ] Add token refresh logic in middleware

#### Step 7: Test YouTube Integration
- [ ] Import real playlist
- [ ] Export filtered playlist
- [ ] Verify no quota errors

### Phase 3: Frontend Migration (Week 3-4)

#### Step 8: Update Angular Services
- [ ] Create `ApiService`
- [ ] Update `AuthService` to use API
- [ ] Rename `StorageService` → `DatabaseService`
- [ ] Update `YoutubeMusicService` to use API

#### Step 9: Update Environment Config
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api', // Next.js dev server
};

// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://api.sonicvault.com/api', // Production API
};
```

#### Step 10: Add Loading States & Error Handling
- [ ] Add spinner component for API calls
- [ ] Add toast notifications for errors
- [ ] Add retry logic for failed requests

### Phase 4: Data Migration Tools (Week 4)

#### Step 11: Build Export Tool
- [ ] Add "Export Data" button to settings page
- [ ] Download localStorage as JSON

#### Step 12: Build Import Tool
- [ ] Add `/api/migration/import` endpoint
- [ ] Add "Import Data" page in Angular app
- [ ] Test with sample data

### Phase 5: Testing & Deployment (Week 5-6)

#### Step 13: Testing
- [ ] Unit tests for API routes (Jest)
- [ ] Integration tests for critical flows
- [ ] E2E tests with real YouTube API
- [ ] Load testing (Artillery or k6)

#### Step 14: Deploy to Vercel
```bash
# Deploy API (if standalone)
cd sonicvault-api
vercel --prod

# Deploy Angular frontend
cd ytmusic-rating-app
vercel --prod

# Configure custom domains
# api.sonicvault.com → Next.js API
# app.sonicvault.com → Angular app
```

#### Step 15: Post-Deployment
- [ ] Monitor error logs (Vercel Analytics)
- [ ] Set up database backups (Vercel Postgres auto-backups)
- [ ] Monitor API quota usage (Google Cloud Console)

---

## 8. Cost Analysis

### Vercel Pricing (Hobby - Free Tier)

| Resource | Free Tier Limit | Cost if Exceeded |
|----------|-----------------|------------------|
| Serverless Functions | 100 GB-hours/mo | $0.18/GB-hour |
| Bandwidth | 100 GB/mo | $0.40/GB |
| Postgres Storage | 256 MB | $0.25/GB-month |
| Postgres Compute | 60 hours/mo | $0.10/compute-hour |

**Estimated Monthly Cost (100 users):**
- Free tier should suffice for <500 users
- Beyond free tier: ~$5-10/month for 100-500 users

### Scaling Considerations

**If you exceed free tier limits:**

1. **Database**:
   - Upgrade Vercel Postgres: $20/month for 1GB
   - Or migrate to Supabase/Railway for better free tier

2. **API Functions**:
   - Optimize cold starts (use edge runtime)
   - Add caching layer (Redis/Upstash)

3. **Alternative Hosting**:
   - **Railway**: Better free tier ($5 credit/month, 1GB DB)
   - **Render**: Free postgres (90 days), then $7/month
   - **Fly.io**: Free postgres (3GB), free compute (256MB RAM)

---

## 9. Deployment Options Comparison

### Option 1: Stay on Vercel (Recommended)

**Pros:**
- Zero-config deployment (already using it)
- Serverless = pay-per-use (cost-effective)
- Vercel Postgres seamless integration
- Excellent DX (developer experience)

**Cons:**
- Free tier limits can be hit quickly
- Cold starts on free tier (~1-2s)

**Best For:** Current setup, minimal changes

---

### Option 2: Railway

**Pros:**
- More generous free tier ($5 credit/month = ~500 hours compute)
- 1GB Postgres free
- No cold starts (always-on)
- Simple deployment (similar to Vercel)

**Cons:**
- Less mature than Vercel
- No edge network (single region)

**Best For:** Growing beyond Vercel free tier

**Deploy Command:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

---

### Option 3: Render

**Pros:**
- Free Postgres (90 days, then $7/month)
- Free web services (750 hours/month)
- Good for hobby projects

**Cons:**
- Slow cold starts on free tier (~1 min)
- Postgres spins down after 90 days on free tier

**Best For:** Long-term hobby projects (cheap)

---

### Option 4: Fly.io

**Pros:**
- Free Postgres (3GB storage)
- Free compute (256MB RAM)
- Fast global edge network
- No cold starts

**Cons:**
- More complex setup than Vercel
- Requires Docker knowledge

**Best For:** Production apps needing global latency

---

## 10. Recommended Architecture Decision

### **Recommendation: Vercel + Vercel Postgres**

**Reasoning:**
1. You're already on Vercel (minimal migration)
2. Vercel Postgres is serverless (scales to zero)
3. Next.js API routes are perfect for this use case
4. Free tier should handle 100-500 users easily
5. Can always migrate DB later if needed (Prisma makes this easy)

**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│                    Vercel Platform                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────┐        ┌──────────────────┐   │
│  │  Angular App    │        │  Next.js API     │   │
│  │  (Frontend)     │───────▶│  (Backend)       │   │
│  │                 │  HTTP  │                  │   │
│  │  Port: 4200     │        │  /api/*          │   │
│  └─────────────────┘        └──────────────────┘   │
│                                      │               │
│                                      ▼               │
│                             ┌──────────────────┐   │
│                             │ Vercel Postgres  │   │
│                             │ (Neon)           │   │
│                             └──────────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │  YouTube Data API v3   │
                    └────────────────────────┘
```

---

## 11. Security Checklist

Before deploying to production:

- [ ] **Environment Variables**: All secrets in Vercel env vars (not in code)
- [ ] **HTTPS Only**: Enforce HTTPS in production
- [ ] **CORS**: Whitelist only production domain
- [ ] **Rate Limiting**: Implement on all API routes
- [ ] **Input Validation**: Use Zod schemas for all request bodies
- [ ] **SQL Injection**: Use Prisma (auto-prevents)
- [ ] **XSS**: Sanitize user inputs (theme names, playlist names)
- [ ] **CSRF**: Not needed with JWT in httpOnly cookies + SameSite=Strict
- [ ] **Token Encryption**: Encrypt OAuth tokens in DB
- [ ] **Audit Logging**: Log all destructive operations (deletes)
- [ ] **Backup Strategy**: Enable Vercel Postgres auto-backups

---

## 12. Testing Strategy

### Unit Tests (Jest)

```typescript
// Example: Rating API route test
describe('POST /api/ratings', () => {
  it('should create a new rating', async () => {
    const res = await fetch('/api/ratings', {
      method: 'POST',
      body: JSON.stringify({ songId: '123', rating: 8 }),
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie }
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.rating).toBe(8);
  });
});
```

### Integration Tests

- Test full import flow (OAuth → Import playlist → Save to DB)
- Test full export flow (Filter songs → Create playlist → Verify on YouTube)

### Load Testing (k6)

```javascript
// load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100, // 100 virtual users
  duration: '30s',
};

export default function () {
  let res = http.get('https://api.sonicvault.com/api/library');
  check(res, { 'status was 200': (r) => r.status == 200 });
}
```

---

## 13. Rollback Plan

If migration fails, quick rollback strategy:

1. **Keep old Angular app live** until migration proven stable
2. **Deploy to new subdomain first**: `beta.sonicvault.com`
3. **A/B test**: 10% of users on new version
4. **Monitor error rates** (target: <1% error rate)
5. **If errors >5%**: Revert DNS to old app immediately

**Rollback Procedure:**
```bash
# Revert to previous deployment
vercel rollback

# Or redeploy old version
git revert <commit-hash>
vercel --prod
```

---

## 14. Future Enhancements (Post-Migration)

Once database migration is complete, these become possible:

1. **Multi-Device Sync**: Automatic sync across all devices
2. **Collaborative Playlists**: Share ratings with friends
3. **Public Profiles**: Show off your music taste
4. **Social Features**: Follow users, see their top-rated songs
5. **Advanced Analytics**:
   - Most-rated genres
   - Rating trends over time
   - Listening habits insights
6. **Playlist Recommendations**: ML-based suggestions
7. **Offline Support**: PWA with sync when online
8. **Mobile Apps**: React Native app using same API
9. **Email Notifications**: Weekly digest of new music
10. **Spotify Integration**: Import from Spotify too

---

## 15. Next Steps

### Immediate Actions

1. **Review this plan** and decide on architecture
2. **Choose database provider** (Vercel Postgres recommended)
3. **Set up development environment**:
   ```bash
   npx create-next-app@latest sonicvault-api --typescript
   cd sonicvault-api
   npm install prisma @prisma/client
   vercel postgres create
   ```
4. **Create Prisma schema** (copy from Section 3)
5. **Implement first API route** (e.g., `GET /api/auth/me`)
6. **Test with existing Angular app** (update one service first)

### Questions to Answer

- [ ] Do you want standalone API or monorepo?
- [ ] Prefer Vercel Postgres or alternative (Supabase/Railway)?
- [ ] Keep Angular or migrate to Next.js frontend too? (future consideration)
- [ ] Need custom domain now or later?

---

## Conclusion

Migrating to a real database will transform SonicVault from a browser-based tool to a proper web application with persistence, multi-device sync, and scalability. The recommended stack (Vercel + Next.js + Prisma + Postgres) provides the smoothest migration path with minimal infrastructure changes.

**Estimated Timeline:** 5-6 weeks for full migration
**Estimated Cost:** $0-10/month (starts free, scales with usage)
**Risk Level:** Medium (good rollback strategy mitigates risk)

This migration is highly recommended for any app you want to grow beyond personal use.
