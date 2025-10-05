# 🚀 Quick Setup Guide - Enable Real YouTube Login

## You Need to Get Your Google OAuth Credentials First!

### Step 1: Create Google Cloud Project (5 minutes)

1. **Go to:** https://console.cloud.google.com/
2. **Click:** "Select a project" → "NEW PROJECT"
3. **Name it:** "YouTube Music Ratings"
4. **Click:** "CREATE"

### Step 2: Enable YouTube Data API (1 minute)

1. In your new project, go to: **"APIs & Services"** → **"Library"**
2. Search for: **"YouTube Data API v3"**
3. Click on it and press: **"ENABLE"**

### Step 3: Configure OAuth Consent Screen (3 minutes)

1. Go to: **"APIs & Services"** → **"OAuth consent screen"**
2. Choose: **"External"** (unless you have a Google Workspace)
3. Fill in:
   - **App name:** YouTube Music Ratings
   - **User support email:** (your email)
   - **Developer contact:** (your email)
4. Click **"SAVE AND CONTINUE"**
5. On Scopes page, click **"ADD OR REMOVE SCOPES"**
6. Search and add these scopes:
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.force-ssl`
7. Click **"UPDATE"** → **"SAVE AND CONTINUE"**
8. On Test users page, click **"ADD USERS"**
9. Add your Gmail address (you'll use this to test)
10. Click **"SAVE AND CONTINUE"** → **"BACK TO DASHBOARD"**

### Step 4: Create OAuth Client ID (2 minutes)

1. Go to: **"APIs & Services"** → **"Credentials"**
2. Click: **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Choose: **"Web application"**
4. Name: **"YouTube Music Web Client"**
5. Under **"Authorized JavaScript origins"** add:
   ```
   http://localhost:4200
   ```
6. Under **"Authorized redirect URIs"** add:
   ```
   http://localhost:4200/auth/callback
   ```
7. Click **"CREATE"**
8. **COPY YOUR CLIENT ID!** (looks like: `123456789-abc123.apps.googleusercontent.com`)

---

## Step 5: Update Your Code (30 seconds)

### Open: `src/app/services/auth.service.ts`

**Line 14:** Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID:
```typescript
private readonly CLIENT_ID = '123456789-abc123.apps.googleusercontent.com';
```

**Line 23:** Change `true` to `false`:
```typescript
private readonly USE_MOCK_AUTH = false; // CHANGED FROM true
```

> **Note:** The scopes are already correctly configured on lines 16-19. You don't need to change them!

### Open: `src/app/services/youtube-music.service.ts`

**Line 54:** Change `true` to `false`:
```typescript
private readonly USE_MOCK_DATA = false; // CHANGED FROM true
```

---

## Step 6: Test It! (1 minute)

1. Restart your dev server (Ctrl+C, then `ng serve`)
2. Go to: http://localhost:4200
3. Click **"Sign in with YouTube Music"**
4. You'll see the **real Google login screen**!
5. Sign in with the Gmail you added as a test user
6. Grant permissions
7. You'll be redirected back with **your actual playlists**!

---

## 🎉 That's It!

Now your app will:
- ✅ Use real Google OAuth authentication
- ✅ Show your actual YouTube playlists
- ✅ Let you rate your real songs
- ✅ Create playlists on your actual YouTube account

---

## ⚠️ Important Notes

### While Testing (App Status = "Testing"):
- Only users you added as "Test Users" can log in
- This is perfect for development
- No quota limits on test users

### When Ready for Others:
1. Go back to OAuth consent screen
2. Click **"PUBLISH APP"**
3. (May require verification if requesting sensitive scopes)

### API Quotas:
- Free tier: **10,000 units/day**
- Reading playlists: ~3 units each
- Creating playlist: ~50 units
- You're unlikely to hit the limit during testing!

---

## 🐛 Troubleshooting

**"Error: redirect_uri_mismatch"**
- Make sure you added `http://localhost:4200/auth/callback` EXACTLY
- No trailing slash
- Check http (not https) for localhost

**"Error: Access blocked: This app's request is invalid"**
- Make sure you added yourself as a test user in OAuth consent screen
- App must be in "Testing" status

**"No playlists showing"**
- Check browser console for errors
- Make sure YouTube Data API v3 is enabled
- Verify scopes are correct in OAuth consent screen

**"Error 403: Access Not Configured"**
- YouTube Data API v3 is not enabled
- Go back to Step 2

---

## 📋 Quick Checklist

- [ ] Created Google Cloud Project
- [ ] Enabled YouTube Data API v3
- [ ] Configured OAuth consent screen
- [ ] Added scopes (youtube + youtube.force-ssl)
- [ ] Added yourself as test user
- [ ] Created OAuth Client ID
- [ ] Added authorized origins (http://localhost:4200)
- [ ] Added redirect URI (http://localhost:4200/auth/callback)
- [ ] Copied CLIENT_ID
- [ ] Updated auth.service.ts with CLIENT_ID
- [ ] Set USE_MOCK_AUTH = false
- [ ] Set USE_MOCK_DATA = false
- [ ] Restarted dev server
- [ ] Tested login!

---

**Need help?** Open browser console (F12) to see detailed error messages!
