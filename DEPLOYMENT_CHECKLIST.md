# 🚀 Deployment Checklist

Use this checklist to deploy your SonicVault app to Vercel.

## Pre-Deployment Checklist

- [x] Environment files created
- [x] Auth service updated to use environment variables
- [x] .gitignore configured to protect local credentials
- [x] Build configuration updated (angular.json)
- [x] Production build tested successfully
- [ ] Production environment file updated with your credentials
- [ ] Code pushed to GitHub

## Step-by-Step Deployment

### Step 1: Update Production Environment
The production environment file (`src/environments/environment.prod.ts`) has already been configured with your OAuth credentials.

### Step 2: Create GitHub Repository
- [ ] Go to github.com and create new repository
- [ ] Name it (e.g., `sonicvault` or `ytmusic-rating-app`)
- [ ] Keep it public or private (your choice)

### Step 3: Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit - SonicVault ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 4: Deploy to Vercel
- [ ] Go to vercel.com
- [ ] Sign up with GitHub
- [ ] Click "Add New..." → "Project"
- [ ] Import your repository
- [ ] Verify settings:
  - Framework: Angular
  - Build command: `npm run build`
  - Output directory: `dist/ytmusic-rating-app/browser`
- [ ] Click "Deploy"

### Step 5: Update Google OAuth
- [ ] Go to Google Cloud Console
- [ ] Navigate to APIs & Services → Credentials
- [ ] Click your OAuth 2.0 Client ID
- [ ] Add to Authorized JavaScript origins:
  ```
  https://your-app-name.vercel.app
  ```
- [ ] Add to Authorized redirect URIs:
  ```
  https://your-app-name.vercel.app/auth/callback
  ```
- [ ] Save

### Step 6: Update Production Redirect URI
```bash
# Edit src/environments/environment.prod.ts
# Change redirectUri to your actual Vercel URL:
redirectUri: 'https://your-actual-app-name.vercel.app/auth/callback'

# Push the update
git add src/environments/environment.prod.ts
git commit -m "Update production redirect URI"
git push
```

Vercel will automatically redeploy!

### Step 7: Add Test Users
- [ ] Go to Google Cloud Console
- [ ] Navigate to APIs & Services → OAuth consent screen
- [ ] Scroll to "Test users"
- [ ] Click "+ ADD USERS"
- [ ] Add your friends' email addresses
- [ ] Save

### Step 8: Test & Share
- [ ] Visit your Vercel URL
- [ ] Test login with your account
- [ ] Import a playlist
- [ ] Rate some songs
- [ ] Share URL with friends!

## Troubleshooting

### Build Fails on Vercel
✓ Check build logs in Vercel dashboard
✓ Verify output directory: `dist/ytmusic-rating-app/browser`
✓ Make sure all dependencies are in package.json

### "Redirect URI mismatch" Error
✓ Verify you added the exact Vercel URL to Google OAuth
✓ Check both "Authorized origins" and "Authorized redirect URIs"
✓ Make sure `environment.prod.ts` has the correct `redirectUri`

### Friends Can't Log In
✓ Make sure their emails are added to Test users in Google Cloud Console
✓ Check that they're using the exact email address you added

### App Loads But Won't Authenticate
✓ Open browser DevTools → Console
✓ Look for OAuth-related errors
✓ Verify `environment.prod.ts` has correct credentials

## Post-Deployment

### Automatic Updates
Every time you push to GitHub, Vercel will:
1. Pull the latest code
2. Build the app
3. Deploy automatically

Just use:
```bash
git add .
git commit -m "Your update message"
git push
```

### Custom Domain (Optional)
- Buy a domain (Namecheap, GoDaddy, etc.)
- In Vercel: Settings → Domains → Add
- Update DNS records as instructed
- Update Google OAuth with new domain

## Files Reference

- `VERCEL_DEPLOYMENT.md` - Full deployment guide
- `SECURITY_SETUP.md` - Environment variables explanation
- `READY_TO_DEPLOY.md` - Quick summary
- `SETUP_REAL_AUTH.md` - Original OAuth setup guide

---

**Current Status**: ✅ Code is secure and build-tested. Ready to deploy!

**Next Action**: Update `environment.prod.ts` and push to GitHub.
