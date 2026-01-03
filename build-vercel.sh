#!/bin/bash

# Replace API_BASE_URL placeholder in the production environment file.
# The Angular app will fetch other config values from the /api/config endpoint at runtime.
sed -i "s|__API_BASE_URL__|${API_BASE_URL}|g" src/environments/environment.prod.ts

# Run the actual build
npm run build
