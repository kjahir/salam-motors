/*
# Traces record the model exchange, not just its shape

## Why
20260729140000 declared this table "redacted": no raw free-text tool arguments, no
prompt or response content. Step 3 of the Audit page (classify intent and call approved
tools) inherited that rule and became unreadable — it could show that a batch of tools was
planned, but never what prompt produced the plan, what the model answered, or what
arguments each tool was given. Every diagnosis of a step-3 failure ended in a guess.

The trace now records the system instructions sent, the message text in and out, and full
tool arguments. The protection moves from omission-at-the-source to the access gate that
was already here: `admin_org_select_assistant_trace_events` restricts SELECT to active
owner/manager staff of the owning org, and that policy is unchanged by this migration.

Still excluded, enforced by `sanitizeTraceDetails` in the edge function: credentials, API
keys, confirmation/action tokens, and model hidden reasoning.

## Data handling
Comments only. No table, column, index, policy, or grant is altered, and no row is read,
written, or deleted. Rows already written keep their existing shape — they simply predate
the richer details and will show fewer fields than runs recorded from now on.
*/

comment on table public.assistant_trace_events is
  'Append-only implementation timeline for Ask Salam runs. Records the model exchange in full: system instructions, message text, and tool arguments. Excludes credentials, action/confirmation tokens, and model hidden reasoning. Readable only by owner/manager staff of the owning org.';

comment on column public.assistant_trace_events.details_redacted is
  'Diagnostic detail for the event, including prompt and response content. Never store secrets, API keys, action tokens, or hidden model reasoning. Strings are capped and deep structures depth-limited by sanitizeTraceDetails before insert.';
