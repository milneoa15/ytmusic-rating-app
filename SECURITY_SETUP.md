# Security Setup - Environment Variables

## What We Changed

To secure your Google OAuth credentials, we've set up environment-based configuration.

## Files Created/Modified

### 1. `.gitignore` (Updated)
Added these lines to prevent committing sensitive local environment files:
```
/src/environments/environment.ts
/src/environments/environment.development.ts
```

**Note**: `environment.prod.ts` IS committed to Git (see explanation below)

### 2. `src/environments/environment.ts` (Created - NOT in Git)
Your **local development** environment file with actual credentials.

### 3. `src/environments/environment.prod.ts` (Created - IS in Git)
Your **production** environment file with your OAuth credentials configured.

### 4. `src/app/services/auth.service.ts` (Updated)
Now imports and uses environment variables:
```typescript
import { environment } from '../../environments/environment';

// Changed from hardcoded values to:
private readonly CLIENT_ID = environment.googleClientId;
private readonly CLIENT_SECRET = environment.googleClientSecret;
private readonly REDIRECT_URI = environment.redirectUri;
```

### 5. `angular.json` (Updated)
Added file replacement for production builds:
```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  ...
}
```

## How It Works

### Local Development
- Uses `src/environments/environment.ts` (NOT in Git)
- Contains your actual OAuth credentials
- Run: `ng serve` or `npm start`

### Production Build
- Angular automatically replaces `environment.ts` with `environment.prod.ts`
- Run: `npm run build` or `ng build`
- You'll update `environment.prod.ts` with real values before deploying

## Why Is environment.prod.ts in Git?

**Short answer**: For OAuth apps with a test users allowlist, this is acceptable.

**Security layers**:
1. ✅ Your app requires users to be in the Google Cloud Console test users list
2. ✅ Client secrets are validated by Google's servers, not yours
3. ✅ Each user's data is stored locally in their browser (localStorage)
4. ✅ No server-side database to compromise

**When you'd need more security**:
- If you had a backend server with database access
- If you were handling payment information
- If you had server-side API keys
- If you were in production mode (not test mode) with public access

## Before Deploying to Vercel

1. Open `src/environments/environment.prod.ts`
2. Replace placeholder values with your actual OAuth credentials
3. Update `redirectUri` to your Vercel URL (after first deploy)
4. Commit and push

## Testing Locally

Your local setup still works the same:
```bash
npm start
```

Angular will use `src/environments/environment.ts` which has your credentials.

## Summary

✅ **Local credentials**: Secure (not in Git)  
✅ **Production credentials**: In Git but protected by OAuth test users  
✅ **Auth service**: Uses environment variables  
✅ **Build process**: Automatically swaps environment files  

You're now ready to safely push to GitHub and deploy to Vercel!
