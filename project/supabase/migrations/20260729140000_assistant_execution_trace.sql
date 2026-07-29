/*
# Ask Salam detailed execution traces

Adds an append-only, redacted timeline for each assistant run. Trace events
record implementation stages, timings, counts, and safe decisions. They must
never contain model hidden reasoning, credentials, confirmation tokens, raw
free-text tool arguments, or unredacted business rows.
*/

create table if not exists public.assistant_trace_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  run_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in (
    'request', 'context', 'model', 'tool', 'validation', 'persistence', 'response', 'error'
  )),
  event_key text not null,
  status text not null check (status in ('started', 'completed', 'failed', 'skipped', 'info', 'flagged')),
  summary text not null check (char_length(summary) between 1 and 300),
  details_redacted jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details_redacted) = 'object'),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  occurred_at timestamptz not null default now(),
  constraint assistant_trace_events_conversation_org_fkey
    foreign key (conversation_id, org_id)
    references public.assistant_conversations(id, org_id)
    on delete cascade,
  constraint assistant_trace_events_run_org_fkey
    foreign key (run_id, org_id)
    references public.assistant_runs(id, org_id)
    on delete cascade
);

create index if not exists idx_assistant_trace_run_time
  on public.assistant_trace_events (run_id, occurred_at, id);
create index if not exists idx_assistant_trace_org_time
  on public.assistant_trace_events (org_id, occurred_at desc);

alter table public.assistant_trace_events enable row level security;

create policy "admin_org_select_assistant_trace_events"
  on public.assistant_trace_events
  for select
  to authenticated
  using (
    public.is_active_org_staff(org_id, array['owner', 'manager'])
  );

revoke all on table public.assistant_trace_events from public, anon, authenticated;
grant select on table public.assistant_trace_events to authenticated;
grant all on table public.assistant_trace_events to service_role;
grant usage, select on sequence public.assistant_trace_events_id_seq to service_role;

comment on table public.assistant_trace_events is
  'Append-only redacted implementation timeline for Ask Salam runs. Excludes hidden reasoning, credentials, tokens, raw free-text tool arguments, and unredacted records.';
comment on column public.assistant_trace_events.details_redacted is
  'Allow-listed diagnostic metadata only. Never store secrets, action tokens, hidden model reasoning, or raw sensitive payloads.';
