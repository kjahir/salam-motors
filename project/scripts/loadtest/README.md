# Ask Salam load-test skeleton

A starting-point [k6](https://k6.io) script for load-testing the
`assistant-turn` Supabase Edge Function (`supabase/functions/assistant-turn`).
This is deliberately minimal - a single scenario hitting the chat endpoint
with a handful of virtual users - not an exhaustive suite. Extend it as
needed (conversation reuse across a VU's iterations, the action-confirm
flow, `stream: true` / SSE, etc).

## Safety

**Never point this at production.** `assistant-chat.js` refuses to run if
`TARGET_BASE_URL` contains a known production hostname marker (see
`PRODUCTION_HOSTNAME_MARKERS` in the script) and prints a warning if the URL
doesn't obviously look like a staging/local host either. That guard is a
simple string match, not a substitute for actually pointing this at a
disposable staging or local Supabase project - double check the URL
yourself before running.

The app + Supabase project have been live in production with real customer
data since 2026-07-25. Load-testing production would both risk degrading
the real app for real users and generate a pile of fake assistant
conversations/runs/tool-calls in real audit data.

## Prerequisites

- [Install k6](https://grafana.com/docs/k6/latest/set-up/install-k6/).
- A staging (or local) Supabase project with the `assistant-turn` function
  deployed and the assistant migrations applied.
- A staging test user with an active membership in a staging org, and a
  valid Supabase auth JWT for that user (`AUTH_BEARER_TOKEN` below). The
  easiest way to get one: sign in as the staging test user in the app once
  and copy the access token from the browser's network tab / devtools
  (Application > Local Storage > the `sb-<project>-auth-token` entry), or
  use the Supabase JS client's `signInWithPassword` against the staging
  project in a throwaway script.

## Usage

```bash
TARGET_BASE_URL="https://<staging-project-ref>.supabase.co" \
SUPABASE_ANON_KEY="<staging anon key>" \
AUTH_BEARER_TOKEN="<staging user's access token>" \
LOADTEST_VUS=5 \
LOADTEST_DURATION=30s \
k6 run scripts/loadtest/assistant-chat.js
```

Env vars:

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `TARGET_BASE_URL` | yes | - | Staging/local Supabase project base URL. Must not match a production hostname marker. |
| `SUPABASE_ANON_KEY` | yes | - | Staging project's anon key, sent as the `apikey` header. |
| `AUTH_BEARER_TOKEN` | yes | - | A valid access token for a staging test user, sent as `Authorization: Bearer`. |
| `LOADTEST_VUS` | no | `5` | Concurrent virtual users. |
| `LOADTEST_DURATION` | no | `30s` | How long the run lasts. |

## What it does

Each virtual user, on a loop:

1. Picks a random sample question from a small fixed list.
2. POSTs it to `${TARGET_BASE_URL}/functions/v1/assistant-turn` with
   `stream: false` (non-streaming JSON response - simplest to assert on).
3. Checks for a `200` status and a response body containing a `turn` or
   `conversationId`.
4. Sleeps 1-3s before the next iteration, to approximate a human pace
   rather than a tight hammer loop.

Custom metrics reported: `assistant_turn_errors` (check-failure rate) and
`assistant_turn_duration` (response latency, ms). Thresholds in the script
are intentionally loose defaults for a first run - tighten
`p(95)<8000` etc. once you have a real staging baseline.

## Known gaps (not covered by this skeleton)

- No conversation continuity - every iteration starts a fresh conversation
  rather than replying within one, so it doesn't exercise `loadHistory()`'s
  cost on a long-running thread.
- No coverage of the action-confirmation path (`action.token`) or streaming
  (`stream: true` / SSE) responses.
- No ramping VUs profile (`options.stages`) - just a flat `vus`/`duration`.
  Add a `stages` array to `options` in `assistant-chat.js` for a realistic
  ramp-up/ramp-down if/when this needs to model a launch spike.
