#!/bin/bash
TOKEN=$(grep '^export CLOUDFLARE_API_TOKEN=' ~/.bashrc | tail -n 1 | cut -d '=' -f 2 | tr -d '"')
ACCOUNT_ID="4f1121256aad3508036f4e81d9c593f3"

cd /home/linux/wow-addon-web
npm run build

echo "Deploying to Cloudflare Pages..."
CLOUDFLARE_API_TOKEN="$TOKEN" CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" wrangler pages deploy dist --project-name wow-addon-web --branch main --commit-dirty=true
