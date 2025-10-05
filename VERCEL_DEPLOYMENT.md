# Deploying SonicVault to Vercel

This guide will walk you through deploying your SonicVault app to Vercel so you and your friends can access it via a public URL.

## Prerequisites

- A GitHub account (to connect with Vercel)
- Your project code pushed to a GitHub repository
- Google OAuth credentials already configured (which you have)

---

## Step 0: Secure Your Google OAuth Credentials (IMPORTANT!)

**⚠️ NEVER commit your Google OAuth Client ID to GitHub!**

Before pushing to GitHub, we need to move your credentials to environment variables.

### 0.1: Create Environment Files

Environment files have already been created and configured for you:
- `src/environments/environment.ts` - Local development (not in Git)
- `src/environments/environment.prod.ts` - Production (in Git with your credentials)

### 0.2: Update Your Auth Service

Your auth service has already been updated to use environment variables.

### 0.3: Verify .gitignore

Make sure these are in your `.gitignore`:
```
node_modules/
dist/
.angular/
src/environments/environment.ts
src/environments/environment.development.ts
```

Now your actual credentials won't be pushed to GitHub!

---

## Step 1: Push Your Code to GitHub

If you haven't already pushed your code to GitHub:

1. Create a new repository on GitHub (e.g., `sonicvault` or `ytmusic-rating-app`)
2. Initialize git in your project (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. Connect to your GitHub repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended for easy integration)
4. Authorize Vercel to access your GitHub account

---

## Step 3: Import Your Project to Vercel

1. Once logged in, click **"Add New..."** → **"Project"**
2. Vercel will show your GitHub repositories
3. Find your `ytmusic-rating-app` (or whatever you named it) repository
4. Click **"Import"**

---

## Step 4: Configure Build Settings

Vercel should auto-detect that this is an Angular project. Verify these settings:

- **Framework Preset**: Angular
- **Build Command**: `npm run build` or `ng build`
- **Output Directory**: `dist/ytmusic-rating-app/browser` (this is important!)
- **Install Command**: `npm install`

**WAIT!** Don't click Deploy yet - we need to add environment variables first!

---

## Step 4.5: Ready to Deploy

Your production environment file has already been configured with your OAuth credentials.

**IMPORTANT**: The `environment.prod.ts` file **will be committed to GitHub**, but since it's a public OAuth app with restricted test users, this is acceptable. Your app is secured by:
- The test users allowlist in Google Cloud Console
- Client secrets are validated server-side by Google
- Each user's data is stored locally in their browser

Now click **"Deploy"** when ready.

---

## Step 5: Wait for Deployment

Vercel will:
1. Install dependencies
2. Build your Angular app
3. Deploy it to their CDN

This usually takes 2-5 minutes. You'll see a live build log.

Once complete, you'll see:
- ✅ **Deployment successful**
- A URL like: `https://your-app-name.vercel.app`

---

## Step 6: Update Google OAuth Credentials

**CRITICAL STEP** - Your app won't work until you do this!

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your **OAuth 2.0 Client ID**
4. Under **Authorized JavaScript origins**, add:
   ```
   https://your-app-name.vercel.app
   ```
5. Under **Authorized redirect URIs**, add:
   ```
   https://your-app-name.vercel.app
   https://your-app-name.vercel.app/library
   ```
6. Click **"Save"**

**Note**: Replace `your-app-name.vercel.app` with your actual Vercel URL.

---

## Step 7: Update Production Redirect URI

Now that you have your Vercel URL, update the redirect URI:

1. Open `src/environments/environment.prod.ts`
2. Update the `redirectUri` to your actual Vercel URL:
   ```typescript
   redirectUri: 'https://your-app-name.vercel.app/auth/callback'
   ```
3. Commit and push the change:
   ```bash
   git add src/environments/environment.prod.ts
   git commit -m "Update production redirect URI"
   git push
   ```
4. Vercel will automatically redeploy with the new redirect URI

---

## Step 8: Test Your Deployment

1. Visit your Vercel URL: `https://your-app-name.vercel.app`
2. Try logging in with your Google account
3. Test the authentication flow
4. Import a playlist and test the app features

---

## Step 9: Add Your Friends' Emails

As you mentioned, you need to manually add your friends' emails to the OAuth consent screen:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Scroll down to **Test users**
4. Click **"+ ADD USERS"**
5. Enter your friends' email addresses (one per line)
6. Click **"Save"**

Now your friends can access the app using the Vercel URL!

---

## Step 10: Share the URL with Friends

Send your friends:
- The Vercel URL: `https://your-app-name.vercel.app`
- Instructions to sign in with their Google account
- Let them know they need to be added to the test users list

---

## Automatic Deployments (Bonus!)

The best part about Vercel + GitHub:

**Every time you push code to your `main` branch, Vercel will automatically rebuild and redeploy your app!**

To push updates:
```bash
git add .
git commit -m "Your update message"
git push
```

Vercel will detect the push and deploy the new version within minutes.

---

## Custom Domain (Optional)

If you want a custom domain like `sonicvault.com`:

1. Buy a domain from any registrar (Namecheap, GoDaddy, etc.)
2. In your Vercel project dashboard, go to **Settings** → **Domains**
3. Click **"Add"** and enter your domain
4. Follow Vercel's instructions to update your DNS records
5. Update your Google OAuth credentials with the new domain

---

## Troubleshooting

### Issue: "Redirect URI mismatch" error
- **Solution**: Double-check that you added the exact Vercel URL to Google OAuth credentials

### Issue: Build fails on Vercel
- **Solution**: Check the build log. Common issues:
  - Wrong output directory (should be `dist/ytmusic-rating-app/browser`)
  - Missing dependencies in `package.json`
  - TypeScript errors that didn't show locally

### Issue: App loads but can't authenticate
- **Solution**: Verify Google OAuth credentials are updated with the Vercel URL

### Issue: Friends can't access the app
- **Solution**: Make sure their emails are added to the **Test users** list in Google Cloud Console

---

## How Environment Variables Work

Your setup now works like this:

- **Local Development**: Uses `src/environments/environment.ts` (not in Git)
- **Production (Vercel)**: Uses environment variables from Vercel dashboard
- **Security**: Your actual OAuth credentials are never in your GitHub repository

If you need to change credentials later, just update them in:
- Vercel dashboard (for production)
- Your local `environment.ts` file (for development)

---

## Summary

✅ Push code to GitHub  
✅ Connect GitHub to Vercel  
✅ Import and deploy project  
✅ Update Google OAuth credentials  
✅ Add friends as test users  
✅ Share the Vercel URL  

**That's it!** Your app is now live and accessible to anyone you add as a test user.

---

## Support

If you run into issues:
- Check Vercel's build logs in the dashboard
- Verify Google OAuth configuration
- Make sure the output directory is correct

Happy deploying! 🚀
