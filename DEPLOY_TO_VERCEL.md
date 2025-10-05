# Deploy SonicVault to Vercel - Quick Guide

Your app is configured and ready to deploy! Follow these steps.

---

## Step 1: Push Your Code to GitHub

### 1.1: Create a New Repository on GitHub
1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** in the top right → **"New repository"**
3. Name it: `sonicvault` (or whatever you prefer)
4. Make it **Public** or **Private** (your choice)
5. **Don't** initialize with README, .gitignore, or license
6. Click **"Create repository"**

### 1.2: Push Your Code
Copy your repository URL from GitHub (looks like: `https://github.com/YOUR_USERNAME/sonicvault.git`)

Run these commands in your terminal:

```bash
cd "/c/Users/milne/OneDrive/Desktop/webdev course/ytmusic/ytmusic-rating-app"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - SonicVault ready for deployment"

# Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME/YOUR_REPO_NAME` with your actual GitHub repository URL!**

---

## Step 2: Deploy to Vercel

### 2.1: Sign Up for Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (easiest option)
4. Authorize Vercel to access your GitHub account

### 2.2: Import Your Project
1. Once logged in, click **"Add New..."** → **"Project"**
2. Vercel will show your GitHub repositories
3. Find your `sonicvault` repository (or whatever you named it)
4. Click **"Import"**

### 2.3: Add Environment Variables

**BEFORE clicking Deploy**, scroll down to **Environment Variables** section and add these 3 variables.

**Use your actual Google OAuth credentials from the Google Cloud Console.**

**Variable 1:**
- Name: `GOOGLE_CLIENT_ID`
- Value: Your Google Client ID (ends with `.apps.googleusercontent.com`)
- Environment: Check all (Production, Preview, Development)

**Variable 2:**
- Name: `GOOGLE_CLIENT_SECRET`
- Value: Your Google Client Secret (starts with `GOCSPX-`)
- Environment: Check all (Production, Preview, Development)

**Variable 3:**
- Name: `REDIRECT_URI`
- Value: `http://localhost:4200/auth/callback` (we'll update this after first deploy)
- Environment: Check all (Production, Preview, Development)

### 2.4: Configure Build Settings

Verify these settings:

- **Framework Preset**: Angular
- **Root Directory**: `./` (leave as default)
- **Build Command**: `bash build-vercel.sh`
- **Output Directory**: `dist/ytmusic-rating-app/browser` ⚠️ **IMPORTANT!**
- **Install Command**: `npm install`

**Make sure the Output Directory is exactly**: `dist/ytmusic-rating-app/browser`

Click **"Deploy"** and wait 2-5 minutes.

### 2.5: Get Your Vercel URL
Once deployment completes, you'll see:
- ✅ **Deployment successful**
- Your URL: `https://your-app-name.vercel.app`

**Copy this URL** - you'll need it for the next steps!

---

## Step 3: Update Redirect URI Environment Variable

Now that you have your Vercel URL, update the environment variable:

1. In your Vercel project dashboard, click **Settings** → **Environment Variables**
2. Find the `REDIRECT_URI` variable
3. Click the **"..."** menu → **"Edit"**
4. Change the value to: `https://your-actual-app-name.vercel.app/auth/callback`
   **Replace `your-actual-app-name` with your real Vercel subdomain!**
5. Click **"Save"**
6. Go to the **Deployments** tab
7. Click the **"..."** menu on the latest deployment → **"Redeploy"**

Wait ~2 minutes for the redeployment to complete.

---

## Step 4: Update Google OAuth Credentials

**CRITICAL** - Your app won't work until you do this!

### 4.1: Add Your Vercel URL to Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in the right project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your **OAuth 2.0 Client ID** (the one you created earlier)

### 4.2: Update Authorized JavaScript Origins
Under **"Authorized JavaScript origins"**, click **"+ ADD URI"** and add:
```
https://your-actual-app-name.vercel.app
```
**Use your actual Vercel URL!**

### 4.3: Update Authorized Redirect URIs
Under **"Authorized redirect URIs"**, click **"+ ADD URI"** and add:
```
https://your-actual-app-name.vercel.app/auth/callback
```

Click **"Save"** at the bottom.

---

## Step 5: Add Your Friends as Test Users

Since your OAuth app is in "Testing" mode, you need to manually add users:

1. In Google Cloud Console, go to **APIs & Services** → **OAuth consent screen**
2. Scroll down to **"Test users"** section
3. Click **"+ ADD USERS"**
4. Enter your friends' Gmail addresses (one per line):
   ```
   friend1@gmail.com
   friend2@gmail.com
   friend3@gmail.com
   ```
5. Click **"Save"**

---

## Step 6: Test Your Deployment

1. Visit your Vercel URL: `https://your-app-name.vercel.app`
2. Click **"Sign in with Google"**
3. Complete the OAuth flow
4. Try importing a playlist
5. Rate some songs
6. Test all features

If everything works, you're done! 🎉

---

## Step 7: Share with Friends

Send your friends:
1. **The Vercel URL**: `https://your-app-name.vercel.app`
2. **Instructions**: 
   - Go to the URL
   - Sign in with Google
   - Accept the OAuth permissions
   - Start rating songs!

**Note**: They must be added to the Test users list in Google Cloud Console.

---

## Automatic Updates

From now on, every time you push code to GitHub:
```bash
git add .
git commit -m "Your update message"
git push
```

Vercel will automatically:
1. Detect the change
2. Rebuild your app
3. Deploy the new version
4. Update your live URL

No manual redeployment needed! 🚀

---

## Troubleshooting

### Issue: "Redirect URI mismatch" error
**Solution**: 
- Double-check you added the exact Vercel URL to Google OAuth credentials
- Make sure it's added to BOTH "Authorized JavaScript origins" AND "Authorized redirect URIs"
- Verify `environment.prod.ts` has the correct `redirectUri`

### Issue: Build fails on Vercel
**Solution**: 
- Check the Vercel build logs (click on the failed deployment)
- Common issue: Wrong output directory
  - Should be: `dist/ytmusic-rating-app/browser`
- Make sure `package.json` has all dependencies

### Issue: App loads but can't authenticate
**Solution**: 
- Open browser DevTools → Console tab
- Look for errors
- Most likely: OAuth credentials not updated in Google Cloud Console

### Issue: Friends can't log in
**Solution**: 
- Make sure their email addresses are added to "Test users" in Google Cloud Console
- They must use the exact email address you added
- Test users list can take a few minutes to update

### Issue: App works on localhost but not on Vercel
**Solution**: 
- Make sure you updated `environment.prod.ts` with the Vercel URL
- Check that you pushed the changes to GitHub
- Wait for Vercel to redeploy (check the Deployments tab)

---

## Optional: Custom Domain

If you want a custom domain like `sonicvault.com` instead of `your-app.vercel.app`:

1. Buy a domain from any registrar (Namecheap, GoDaddy, etc.)
2. In Vercel dashboard, go to **Settings** → **Domains**
3. Click **"Add"** and enter your domain
4. Follow Vercel's DNS instructions
5. Update your Google OAuth credentials with the new domain
6. Update `environment.prod.ts` with the new domain

---

## Summary Checklist

- [x] Environment files configured
- [x] Production credentials set
- [ ] Code pushed to GitHub
- [ ] Project imported to Vercel
- [ ] First deployment complete
- [ ] Redirect URI updated in code
- [ ] Changes pushed (triggers redeploy)
- [ ] Google OAuth updated with Vercel URL
- [ ] Test users added
- [ ] App tested and working
- [ ] URL shared with friends

---

## Your Current Status

✅ **Environment configured** - Your OAuth credentials are set  
✅ **Build tested** - Production build works  
✅ **Security configured** - Local credentials protected by .gitignore  

**Next Action**: Push to GitHub (Step 1)

---

**Need help?** Check the Vercel dashboard for build logs and deployment status.

Good luck! 🚀
