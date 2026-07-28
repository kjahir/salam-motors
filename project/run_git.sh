#!/usr/bin/env bash
set -euo pipefail

git add -A
git commit -m "enhancement"
git push -u origin staging
npx supabase functions deploy assistant-transcribe
npx supabase functions deploy assistant-speech
