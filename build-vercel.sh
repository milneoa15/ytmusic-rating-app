#!/bin/bash

# Replace placeholders in environment.prod.ts with Vercel environment variables
sed -i "s|__GOOGLE_CLIENT_ID__|${GOOGLE_CLIENT_ID}|g" src/environments/environment.prod.ts
sed -i "s|__GOOGLE_CLIENT_SECRET__|${GOOGLE_CLIENT_SECRET}|g" src/environments/environment.prod.ts
sed -i "s|__REDIRECT_URI__|${REDIRECT_URI}|g" src/environments/environment.prod.ts

# Run the actual build
npm run build
