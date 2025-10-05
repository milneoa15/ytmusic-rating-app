# YouTube API Integration Guide

This document explains how to integrate your Angular app with the YouTube Data API v3.

## 🔑 Getting Your API Credentials

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "YouTube Music Rating App"
4. Click "Create"

### Step 2: Enable YouTube Data API v3

1. In your project, go to "APIs & Services" → "Library"
2. Search for "YouTube Data API v3"
3. Click on it and press "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: YouTube Music Rating App
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add the following scopes:
     - `https://www.googleapis.com/auth/youtube`
     - `https://www.googleapis.com/auth/youtube.force-ssl`
4. Application type: "Web application"
5. Name: "YouTube Music Rating Web Client"
6. Authorized JavaScript origins:
   - `http://localhost:4200` (for development)
   - `https://yourdomain.com` (for production)
7. Authorized redirect URIs:
   - `http://localhost:4200/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)
8. Click "Create"
9. **Copy your Client ID** - you'll need this!

## 🔧 Configure Your Application

### 1. Update AuthService

Edit `src/app/services/auth.service.ts`:

```typescript
// Replace these values:
private readonly CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
private readonly REDIRECT_URI = 'http://localhost:4200/auth/callback';

// When ready to go live:
private readonly USE_MOCK_AUTH = false; // Change to false
```

### 2. Update YoutubeMusicService

Edit `src/app/services/youtube-music.service.ts`:

```typescript
// When ready to go live:
private readonly USE_MOCK_DATA = false; // Change to false
```

### 3. Add OAuth Callback Route

The app is already configured to handle `/auth/callback`, but make sure your routing allows it.

## 📡 API Endpoints Used

### 1. Get User's Playlists
```
GET https://www.googleapis.com/youtube/v3/playlists
  ?part=snippet,contentDetails
  &mine=true
  &maxResults=50
```
**Headers:**
```
Authorization: Bearer {access_token}
```

### 2. Get Playlist Items (Songs)
```
GET https://www.googleapis.com/youtube/v3/playlistItems
  ?part=snippet,contentDetails
  &playlistId={playlistId}
  &maxResults=50
```
**Headers:**
```
Authorization: Bearer {access_token}
```

### 3. Create Playlist
```
POST https://www.googleapis.com/youtube/v3/playlists
  ?part=snippet,status
```
**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```
**Body:**
```json
{
  "snippet": {
    "title": "Playlist Name",
    "description": "Playlist Description"
  },
  "status": {
    "privacyStatus": "private"
  }
}
```

### 4. Add Song to Playlist
```
POST https://www.googleapis.com/youtube/v3/playlistItems
  ?part=snippet
```
**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```
**Body:**
```json
{
  "snippet": {
    "playlistId": "{playlistId}",
    "resourceId": {
      "kind": "youtube#video",
      "videoId": "{videoId}"
    }
  }
}
```

## 🔐 OAuth 2.0 Flow

### How it works:

1. **User clicks "Sign in with YouTube Music"**
   - App redirects to Google OAuth consent screen
   - URL includes: client_id, redirect_uri, scopes, state (for CSRF protection)

2. **User grants permission**
   - Google redirects back to your app with authorization code
   - URL: `http://localhost:4200/auth/callback?code=...&state=...`

3. **App exchanges code for tokens**
   - Makes POST request to token endpoint
   - Receives: access_token, refresh_token, expires_in

4. **App uses access token**
   - Includes in Authorization header: `Bearer {access_token}`
   - Token is valid for ~1 hour

5. **Token refresh**
   - When token expires, use refresh_token to get new access_token
   - Refresh tokens don't expire (unless revoked)

## 🧪 Testing

### Development Mode (Mock Data)
Currently enabled by default:
```typescript
USE_MOCK_AUTH = true
USE_MOCK_DATA = true
```

This allows you to:
- Test UI without real API calls
- See how data flows through the app
- Develop without API quota limits

### Production Mode (Real API)
When ready:
```typescript
USE_MOCK_AUTH = false
USE_MOCK_DATA = false
```

## ⚠️ Important Notes

### API Quotas
YouTube Data API has quota limits:
- **10,000 quota units per day** (default)
- Reading playlists: ~3 units each
- Reading playlist items: ~3 units each
- Creating playlist: ~50 units
- Adding item to playlist: ~50 units each

**Request quota increase** if needed in Google Cloud Console.

### Privacy Status Options
When creating playlists:
- `"public"` - Anyone can see
- `"private"` - Only you can see
- `"unlisted"` - Anyone with link can see

### Token Security
- **Never commit tokens to Git**
- Access tokens in localStorage are accessible via JavaScript
- For production, consider using httpOnly cookies with backend

### Rate Limiting
- Implement exponential backoff for failed requests
- Handle 403 (quota exceeded) and 401 (unauthorized) errors
- Current implementation includes basic error handling

## 🐛 Troubleshooting

### Error: "Access blocked: Authorization Error"
- Make sure OAuth consent screen is configured
- Add test users if app is in testing mode
- Check that scopes match what you configured

### Error: "redirect_uri_mismatch"
- Verify redirect URI exactly matches what's in Google Cloud Console
- Include http/https correctly
- No trailing slashes

### Error: "invalid_client"
- Check CLIENT_ID is correct
- Make sure API is enabled in Cloud Console

### No playlists showing
- Verify token has correct scopes
- Check browser console for API errors
- Ensure playlist API is enabled

### Songs not loading
- Check playlistId is valid
- Verify API quota isn't exceeded
- Look for errors in network tab

## 📊 Response Examples

### Playlists Response
```json
{
  "items": [
    {
      "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
      "snippet": {
        "title": "My Playlist",
        "description": "Description here",
        "thumbnails": {
          "medium": {
            "url": "https://i.ytimg.com/..."
          }
        }
      },
      "contentDetails": {
        "itemCount": 25
      }
    }
  ]
}
```

### Playlist Items Response
```json
{
  "items": [
    {
      "id": "PLitemId123",
      "snippet": {
        "title": "Song Title",
        "videoOwnerChannelTitle": "Artist Name",
        "thumbnails": {
          "medium": {
            "url": "https://i.ytimg.com/..."
          }
        },
        "resourceId": {
          "videoId": "dQw4w9WgXcQ"
        }
      }
    }
  ]
}
```

## 🚀 Deployment Considerations

### Before deploying to production:

1. **Update redirect URIs** with production domain
2. **Enable real OAuth** (set USE_MOCK_AUTH = false)
3. **Enable real API calls** (set USE_MOCK_DATA = false)
4. **Request quota increase** if needed
5. **Publish OAuth app** (move from testing to production)
6. **Implement error tracking** (e.g., Sentry)
7. **Add analytics** to monitor usage
8. **Set up backend** for secure token storage (recommended)

### Environment Variables
Consider using Angular environments:

```typescript
// environment.ts
export const environment = {
  production: false,
  youtubeClientId: 'YOUR_DEV_CLIENT_ID',
  redirectUri: 'http://localhost:4200/auth/callback'
};

// environment.prod.ts
export const environment = {
  production: true,
  youtubeClientId: 'YOUR_PROD_CLIENT_ID',
  redirectUri: 'https://yourdomain.com/auth/callback'
};
```

## 📚 Additional Resources

- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [API Explorer](https://developers.google.com/youtube/v3/docs) - Test API calls
- [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)

## ✅ Checklist

Before going live:

- [ ] Created Google Cloud Project
- [ ] Enabled YouTube Data API v3
- [ ] Created OAuth 2.0 credentials
- [ ] Configured OAuth consent screen
- [ ] Added authorized redirect URIs
- [ ] Updated CLIENT_ID in auth.service.ts
- [ ] Updated redirect URI in auth.service.ts
- [ ] Set USE_MOCK_AUTH = false
- [ ] Set USE_MOCK_DATA = false
- [ ] Tested OAuth flow
- [ ] Tested playlist import
- [ ] Tested playlist creation
- [ ] Tested adding songs to playlist
- [ ] Verified error handling
- [ ] Checked API quota usage
- [ ] Deployed to production

---

**Need help?** Check the [YouTube API Support](https://support.google.com/youtube/community) or file an issue in your repository.
