#!/usr/bin/env bash
set -euo pipefail

git add -A
git commit -m "enhancement"
git push -u origin staging
supabase functions deploy assistant-transcribe
supabase functions deploy assistant-speech
