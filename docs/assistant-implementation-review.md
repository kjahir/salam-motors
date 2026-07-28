# Ask Salam implementation review

Review date: 2026-07-29

Reviewed branch: `staging`

Configured Supabase project: `swgxitzcylokelhqlcfe`

No migration, write smoke test, or other mutation was run against the linked
Supabase project during this review.

## Verdict

The implementation is a strong security-oriented foundation, but it is not yet
the complete production-beta scope described in `docs/askSalamAgent.md`.
The Edge Function architecture is appropriate for this application: caller JWT
and RLS remain authoritative, model output is schema-validated, risky commands
use stored proposals and signed confirmation tokens, and the frontend renders
typed blocks rather than model-authored HTML.

## Working well

- Six-locale request and response contracts, localized deterministic receipts,
  and script-conformance observability.
- Role-projected read tools for inventory, vehicle details, ageing,
  compliance alerts, and partner portfolio.
- Typed response schema and a custom React renderer with plain-text handling.
- Caller-bound conversation persistence, run/tool audit records, and
  organization-scoped RLS.
- Signed action tokens bound to user, organization, conversation, proposal,
  arguments, and expiry.
- Transactional vehicle onboarding and sale completion commands with
  idempotency and authoritative sale guards.
- OpenAI Responses API requests use structured outputs, function tools,
  `store: false`, encrypted reasoning replay, and `safety_identifier`.

## Corrected in this review

1. Default deadline budgeting

   The 30-second default turn deadline was shorter than the 45-second OpenAI
   timeout plus the old buffer, so every first round forced
   `tool_choice: "none"`. Per-round budgets now reserve final-answer time while
   allowing tools under the defaults.

2. Atomic confirmation and execution

   Confirmation and the business command previously used separate RPC calls.
   The new migration exposes one wrapper RPC per command, revokes direct
   authenticated access to the underlying steps, and rolls confirmation back
   if the command fails.

3. Safe action retries

   A retry with a still-valid signed token now renders the completed proposal's
   stored outcome without executing the command again.

4. Client request ownership

   Same-tick duplicate submissions are blocked, and a response that arrives
   after Stop, Clear, or an identity change cannot restore stale conversation
   state.

5. Localized failures

   HTTP and SSE error code, status, and retryability metadata now survive the
   API client boundary. The provider maps those codes to existing localized
   error keys instead of displaying backend English in Tamil or Hindi.

6. Configuration and navigation

   Weak action-token secrets disable writes, and the assistant can navigate
   authorized desktop owners/managers to the newly added Audit page.

## Remaining release gates

### P0 - before production beta

- Add per-user and per-organization request limits, concurrency limits, and a
  model-cost budget. Upstream project limits alone are not enough.
- Make `acknowledge_alert` deterministically require an explicit user intent.
  It is currently an immediate model-selected write protected by role/RLS and
  audit, but the explicit-request rule exists only in model instructions.
- Apply the atomic wrapper migration before deploying the updated Edge
  Function, then run an authenticated read smoke test and a disposable
  low-value write test.
- Add disposable-database integration tests proving rollback, replay,
  cross-organization denial, role denial, and concurrent confirmation
  behavior for the real PostgreSQL RPCs.

### P1 - quality and scale

- Build the planned 400-500 golden conversation evaluation set, with dedicated
  Tamil and Hindi slices for tool choice, grounding, refusals, prompt
  injection, and confirmation behavior.
- Canonicalize or validate displayed vehicle fields, metrics, statuses, and
  money against tool results. Provenance IDs are grounded today, but arbitrary
  model-authored block values are not all checked against canonical evidence.
- Move inventory filtering into a database RPC. The current client-side filter
  examines only the latest 250 rows and can miss an older matching vehicle.
- Add fresh authorization/step-up policy for critical sale completion after
  the product chooses the MFA experience.
- Add an active-organization selector before supporting users with more than
  one active membership.

### P2 - planned product expansion

- True model-token streaming while retaining the validated final structured
  turn.
- URL-addressable assistant navigation and conversation restoration.
- Attachments, artifact downloads, document previews, and the remaining
  capability catalog from the original plan.
- Automated language-quality remediation instead of observability-only script
  mismatch logging.

## Deployment order

1. Review and apply
   `20260729100000_atomic_assistant_confirmation_execution.sql`.
2. Deploy `assistant-turn` so it calls the new atomic RPC names.
3. Deploy the frontend.
4. Run the smoke tests in `docs/assistant-deployment.md`.
