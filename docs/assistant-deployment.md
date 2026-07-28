# Ask Salam Assistant — Deployment Runbook

The assistant ships as one Supabase Edge Function (`assistant-turn`), nine
database migrations, and frontend code that is already integrated into the
desktop and mobile apps. Nothing below runs automatically — every step is a
deliberate action against the **live production** project.

## 1. Prerequisites

```bash
cd project
supabase link   # if not already linked to the production project
```

## 2. Database migrations

**Before pushing, always check for unrelated pending migrations:**

```bash
supabase migration list --linked
```

If unrelated migrations are pending (created by someone else and not meant to
go out now), do NOT run a blanket `db push`. Apply the assistant migrations
individually via `psql` and insert their rows into
`supabase_migrations.schema_migrations` manually, as done previously in this
repo.

If the list is clean, push all nine:

```bash
supabase db push
```

The new migrations, in order:

| Migration | Purpose |
|---|---|
| `20260727209000_extensions_prerequisite.sql` | Required extensions |
| `20260727210000_assistant_security_control_plane.sql` | Assistant tables (conversations, messages, runs, tool calls, action proposals, idempotency, audit) + confirm/reject RPCs |
| `20260727211000_business_security_hardening.sql` | Org-scoped storage policies, privilege revocations |
| `20260727211200_membership_integrity.sql` | Membership identity/last-owner protection |
| `20260727211500_legacy_open_rls_cutover.sql` | Drops legacy anonymous table policies |
| `20260727211700_public_passport_rpc.sql` | Secure public passport RPC |
| `20260727212000_transactional_assistant_commands.sql` | Atomic `assistant_create_vehicle_with_purchase` / `assistant_complete_vehicle_sale` |
| `20260727212500_revoke_legacy_anonymous_storage_policies.sql` | Defensive no-op cleanup of legacy storage policy names |
| `20260729100000_atomic_assistant_confirmation_execution.sql` | Confirms and executes each assistant business command in one rollback-safe transaction |

## 3. Edge Function secrets

Set before (or immediately after) deploying the function:

```bash

supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ASSISTANT_ACTION_TOKEN_SECRET="$(openssl rand -base64 48)"
```

- `OPENAI_API_KEY` — required. Without it every chat turn returns
  `OPENAI_NOT_CONFIGURED` (503).
- `ASSISTANT_ACTION_TOKEN_SECRET` — required for write actions (≥32 random
  bytes). Without it read-only chat works but proposal tools return
  `ACTIONS_NOT_CONFIGURED`. Rotating it invalidates outstanding confirmations,
  which is safe (users just re-propose). Values shorter than 32 encoded bytes
  are treated as unavailable and leave write actions disabled.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are
  injected automatically by the Supabase platform. The service-role key
  enables run/tool-call/assistant-message persistence; without it the chat
  still works but observability rows are not written.

Optional tuning (defaults in `supabase/functions/_shared/assistant/config.ts`):

| Variable | Default |
|---|---|
| `OPENAI_MODEL` | `gpt-5.6-terra` |
| `OPENAI_REASONING_EFFORT` | `low` (`none/low/medium/high/xhigh/max`) |
| `OPENAI_TIMEOUT_MS` | 45000 |
| `ASSISTANT_MAX_TURN_MS` | 30000 |
| `ASSISTANT_MAX_TOOL_ROUNDS` | 5 |
| `ASSISTANT_MAX_TOOL_CALLS` | 10 |
| `ASSISTANT_MAX_OUTPUT_TOKENS` | 3200 |
| `ASSISTANT_ACTION_TTL_SECONDS` | 600 |
| `ASSISTANT_SAFETY_SALT` | `salam-motors-assistant-v1` |

## 4. Deploy the function

```bash
supabase functions deploy assistant-turn
```

Relative imports from `functions/_shared/` are bundled automatically.

## 5. Smoke test

1. CORS preflight (no auth required):

   ```bash
   curl -i -X OPTIONS https://<project-ref>.supabase.co/functions/v1/assistant-turn
   ```

   Expect `200` with `Access-Control-Allow-Methods: POST, OPTIONS`.

2. Read-only chat turn (use a real signed-in user's access token):

   ```bash
   curl -s -X POST https://<project-ref>.supabase.co/functions/v1/assistant-turn \
     -H "Authorization: Bearer <access_token>" \
     -H "apikey: <anon_key>" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{"message":"Show vehicles older than 45 days","locale":"en-IN","context":{"surface":"desktop"},"stream":false}'
   ```

   Expect `{"conversationId":"...","turn":{...}}` with `schemaVersion: "1.0"`.

3. In the app, open the assistant and run a read-only query in each language.

4. Only after reads are verified: test the write path with a low-value action
   (a vehicle onboarding proposal) and confirm the receipt, the
   `assistant_action_proposals` row, and the audit trail. **Do not test
   `complete_sale` against a real vehicle** — it mutates production sale and
   distribution records.

## 6. Rollback

- Function: `supabase functions delete assistant-turn` (frontend degrades to
  an error toast; the rest of the app is unaffected), or redeploy a previous
  version.
- Kill-switch without deleting: unset `OPENAI_API_KEY` (disables chat) or
  `ASSISTANT_ACTION_TOKEN_SECRET` (disables writes, keeps read-only chat).
- The migrations are additive (new tables/RPCs) plus policy drops that were
  already applied by earlier migrations; no rollback is expected to be needed.

## Known limitations

- The SSE endpoint streams status immediately, but answer deltas are emitted
  only after the complete structured turn passes validation. This protects the
  renderer but does not reduce model time-to-first-answer-token.
- There is no application-level per-user request or model-cost quota yet.
  Configure upstream project limits before broad production rollout, then add
  a dealership/user rate-limit policy before enabling an open beta.
- Deno tests for the backend live in `supabase/functions/_shared/assistant/`
  (`deno test _shared/assistant/` from `supabase/functions/`); they are not
  part of the frontend vitest run.
