/*
# AI assistant security control plane

Adds the durable records and database-side authorization primitives needed by
an AI assistant without giving a model generic table or SQL access.

Design invariants:
- Every assistant record is tenant-scoped and actor-scoped.
- New assistant commands use an explicit, request-bound org_id.
- A suspended organization is never considered active.
- Human confirmation is represented by a short-lived, actor-bound proposal.
- Idempotency and security audit records are server controlled.
- Raw access tokens, confirmation tokens, storage signed URLs, and unrestricted
  tool payloads must never be stored in these tables.

This migration is additive except for hardening the existing org helper
functions and the documented self-serve organization eligibility check.
*/

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Active organization helpers
-- ============================================================

create or replace function public.is_active_org_staff(
  p_org_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  )
$$;

create or replace function public.is_active_org_partner(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.partners p
    join public.organizations o on o.id = p.org_id
    where p.org_id = p_org_id
      and p.auth_user_id = auth.uid()
      and p.status = 'active'
      and p.deleted_at is null
      and o.status = 'active'
  )
$$;

create or replace function public.is_active_org_principal(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_org_staff(p_org_id)
      or public.is_active_org_partner(p_org_id)
$$;

create or replace function public.current_user_org_role(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  join public.organizations o on o.id = m.org_id
  where m.org_id = p_org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

/*
`current_org_id()` remains for existing client defaults, but it no longer
silently chooses an arbitrary tenant. Users with more than one active
membership must use an explicit-org command.
*/
create or replace function public.current_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org_ids uuid[];
begin
  if auth.uid() is null then
    return null;
  end if;

  select array_agg(m.org_id order by m.created_at, m.org_id)
  into v_org_ids
  from public.memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active';

  if coalesce(cardinality(v_org_ids), 0) = 0 then
    return null;
  end if;

  if cardinality(v_org_ids) > 1 then
    raise exception using
      errcode = '22023',
      message = 'Multiple active organizations; an explicit organization is required';
  end if;

  return v_org_ids[1];
end;
$$;

/*
Backward-compatible replacement used by all existing RLS policies. It now
honors organization suspension.
*/
create or replace function public.is_org_member(
  p_org_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_org_staff(p_org_id, p_roles)
$$;

create or replace function public.is_partner_self(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.partners p
    join public.organizations o on o.id = p.org_id
    where p.id = p_partner_id
      and p.auth_user_id = auth.uid()
      and p.deleted_at is null
      and p.status = 'active'
      and o.status = 'active'
  )
$$;

create or replace function public.resolve_request_org(
  p_org_id uuid,
  p_allow_partner boolean default true
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_org_id is null then
    raise exception using errcode = '22004', message = 'Explicit organization is required';
  end if;

  if public.is_active_org_staff(p_org_id)
     or (p_allow_partner and public.is_active_org_partner(p_org_id)) then
    return p_org_id;
  end if;

  raise exception using errcode = '42501', message = 'No active access to this organization';
end;
$$;

revoke all on function public.is_active_org_staff(uuid, text[]) from public, anon;
revoke all on function public.is_active_org_partner(uuid) from public, anon;
revoke all on function public.is_active_org_principal(uuid) from public, anon;
revoke all on function public.current_user_org_role(uuid) from public, anon;
revoke all on function public.current_org_id() from public, anon;
revoke all on function public.is_org_member(uuid, text[]) from public, anon;
revoke all on function public.is_partner_self(uuid) from public, anon;
revoke all on function public.resolve_request_org(uuid, boolean) from public, anon;

grant execute on function public.is_active_org_staff(uuid, text[]) to authenticated;
grant execute on function public.is_active_org_partner(uuid) to authenticated;
grant execute on function public.is_active_org_principal(uuid) to authenticated;
grant execute on function public.current_user_org_role(uuid) to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_org_member(uuid, text[]) to authenticated;
grant execute on function public.is_partner_self(uuid) to authenticated;
grant execute on function public.resolve_request_org(uuid, boolean) to authenticated;

-- Existing definer functions must not retain PostgreSQL's default PUBLIC
-- execute privilege.
revoke all on function public.next_stock_number() from public, anon;
revoke all on function public.check_registration_available(text, uuid) from public, anon;
grant execute on function public.next_stock_number() to authenticated;
grant execute on function public.check_registration_available(text, uuid) to authenticated;

-- Partner organization reads must honor both partner and org status.
drop policy if exists "select_own_org" on public.organizations;
create policy "select_own_org"
  on public.organizations
  for select
  to authenticated
  using (
    public.is_active_org_staff(id)
    or public.is_active_org_partner(id)
  );

-- ============================================================
-- Safe self-serve organization onboarding
-- ============================================================

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_email text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  -- Serialize concurrent onboarding attempts by the same principal.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 73921)
  );

  if p_name is null
     or char_length(pg_catalog.btrim(p_name)) < 2
     or char_length(pg_catalog.btrim(p_name)) > 120 then
    raise exception using
      errcode = '22023',
      message = 'Organization name must be between 2 and 120 characters';
  end if;

  if exists (
    select 1 from public.memberships m where m.user_id = v_user_id
  ) or exists (
    select 1 from public.partners p where p.auth_user_id = v_user_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This account is already linked to an organization';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_user_id;

  if v_email is null then
    raise exception using errcode = '28000', message = 'Authenticated user record not found';
  end if;

  v_base_slug := pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g')
  );
  v_base_slug := pg_catalog.btrim(v_base_slug, '-');
  if v_base_slug = '' then
    v_base_slug := 'dealership';
  end if;
  v_base_slug := pg_catalog.substr(v_base_slug, 1, 80);
  v_slug := v_base_slug;

  loop
    begin
      insert into public.organizations (name, slug, status)
      values (pg_catalog.btrim(p_name), v_slug, 'active')
      returning id into v_org_id;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > 50 then
        v_slug := v_base_slug || '-' || pg_catalog.substr(gen_random_uuid()::text, 1, 8);
      else
        v_slug := v_base_slug || '-' || v_suffix::text;
      end if;
    end;
  end loop;

  insert into public.memberships (
    org_id, user_id, role, status, email, joined_at
  ) values (
    v_org_id, v_user_id, 'owner', 'active', v_email, pg_catalog.now()
  );

  -- New organizations otherwise have no app_settings singleton.
  insert into public.app_settings (
    org_id,
    estimated_profit_margin_low_pct,
    estimated_profit_margin_high_pct,
    updated_at,
    updated_by
  ) values (
    v_org_id, 10, 30, pg_catalog.now(), v_email
  ) on conflict (org_id) do nothing;

  return v_org_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- ============================================================
-- Capability registry
-- ============================================================

create table if not exists public.assistant_capabilities (
  action_type text primary key,
  description text not null,
  allowed_roles text[] not null default '{}'::text[],
  allow_partner boolean not null default false,
  risk_level text not null
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  requires_confirmation boolean not null default true,
  requires_step_up boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.assistant_capabilities (
  action_type, description, allowed_roles, allow_partner,
  risk_level, requires_confirmation, requires_step_up
) values
  (
    'vehicle.create_with_purchase',
    'Create a vehicle, purchase, initial payment, and optional listing atomically',
    array['owner','manager'], false, 'high', true, false
  ),
  (
    'vehicle.complete_sale',
    'Complete a sale and calculate partner distributions atomically',
    array['owner'], false, 'critical', true, false
  ),
  (
    'vehicle.archive',
    'Archive an eligible vehicle',
    array['owner','manager'], false, 'critical', true, false
  ),
  (
    'listing.publish',
    'Publish or unpublish a public vehicle passport',
    array['owner','manager','sales_executive'], false, 'high', true, false
  ),
  (
    'expense.record',
    'Create or change a vehicle expense',
    array['owner','manager','accountant'], false, 'medium', true, false
  ),
  (
    'investment.record',
    'Record partner capital',
    array['owner','accountant'], false, 'high', true, false
  ),
  (
    'settlement.record',
    'Record a partner settlement ledger payment',
    array['owner','accountant'], false, 'critical', true, false
  ),
  (
    'inspection.record',
    'Create or update an inspection',
    array['owner','manager','mechanic_inspector'], false, 'medium', true, false
  ),
  (
    'alert.acknowledge',
    'Acknowledge an operational alert',
    array['owner','manager','sales_executive','accountant','mechanic_inspector'],
    false, 'low', false, false
  ),
  (
    'policy.modify',
    'Create or change a compliance policy',
    array['owner','manager'], false, 'high', true, false
  ),
  (
    'team.invite',
    'Invite a staff member',
    array['owner'], false, 'high', true, true
  ),
  (
    'team.change_role',
    'Change a staff member role',
    array['owner'], false, 'critical', true, true
  ),
  (
    'team.suspend',
    'Suspend or restore staff access',
    array['owner'], false, 'critical', true, true
  ),
  (
    'partner.portal_access',
    'Grant or revoke partner portal access',
    array['owner'], false, 'high', true, true
  )
on conflict (action_type) do nothing;

alter table public.assistant_capabilities enable row level security;

drop policy if exists "authenticated_read_assistant_capabilities"
  on public.assistant_capabilities;
create policy "authenticated_read_assistant_capabilities"
  on public.assistant_capabilities
  for select
  to authenticated
  using (true);

-- ============================================================
-- Conversation, message, run, tool, feedback, proposal,
-- idempotency, and audit records
-- ============================================================

create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  title text,
  locale text not null default 'en',
  status text not null default 'active'
    check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content jsonb not null,
  language text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  client_message_id text,
  model text,
  safety_labels jsonb not null default '{}'::jsonb
    check (jsonb_typeof(safety_labels) = 'object'),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  constraint assistant_messages_conversation_org_fkey
    foreign key (conversation_id, org_id)
    references public.assistant_conversations(id, org_id)
    on delete cascade
);

create unique index if not exists uq_assistant_messages_client_id
  on public.assistant_messages (conversation_id, client_message_id)
  where client_message_id is not null;

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  input_message_id uuid,
  output_message_id uuid,
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','cancelled')),
  model text not null,
  trace_id text,
  idempotency_key text,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  usage jsonb not null default '{}'::jsonb
    check (jsonb_typeof(usage) = 'object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  constraint assistant_runs_conversation_org_fkey
    foreign key (conversation_id, org_id)
    references public.assistant_conversations(id, org_id)
    on delete cascade,
  constraint assistant_runs_input_message_org_fkey
    foreign key (input_message_id, org_id)
    references public.assistant_messages(id, org_id),
  constraint assistant_runs_output_message_org_fkey
    foreign key (output_message_id, org_id)
    references public.assistant_messages(id, org_id)
);

create unique index if not exists uq_assistant_runs_idempotency
  on public.assistant_runs (org_id, requested_by_user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.assistant_tool_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null,
  run_id uuid not null,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  status text not null default 'requested'
    check (status in ('requested','running','completed','denied','failed','cancelled')),
  risk_level text not null default 'low'
    check (risk_level in ('low','medium','high','critical')),
  arguments_redacted jsonb not null default '{}'::jsonb,
  result_redacted jsonb,
  authorization_decision jsonb not null default '{}'::jsonb,
  idempotency_key text,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  constraint assistant_tool_calls_conversation_org_fkey
    foreign key (conversation_id, org_id)
    references public.assistant_conversations(id, org_id)
    on delete cascade,
  constraint assistant_tool_calls_run_org_fkey
    foreign key (run_id, org_id)
    references public.assistant_runs(id, org_id)
    on delete cascade
);

create unique index if not exists uq_assistant_tool_calls_idempotency
  on public.assistant_tool_calls (run_id, tool_name, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.assistant_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null,
  message_id uuid,
  run_id uuid,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  category text,
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_feedback_one_target_check
    check (num_nonnulls(message_id, run_id) = 1),
  constraint assistant_feedback_conversation_org_fkey
    foreign key (conversation_id, org_id)
    references public.assistant_conversations(id, org_id)
    on delete cascade,
  constraint assistant_feedback_message_org_fkey
    foreign key (message_id, org_id)
    references public.assistant_messages(id, org_id)
    on delete cascade,
  constraint assistant_feedback_run_org_fkey
    foreign key (run_id, org_id)
    references public.assistant_runs(id, org_id)
    on delete cascade
);

create unique index if not exists uq_assistant_feedback_message
  on public.assistant_feedback (created_by_user_id, message_id)
  where message_id is not null;

create unique index if not exists uq_assistant_feedback_run
  on public.assistant_feedback (created_by_user_id, run_id)
  where run_id is not null;

create table if not exists public.assistant_action_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null,
  run_id uuid,
  tool_call_id uuid,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null references public.assistant_capabilities(action_type),
  target_type text,
  target_id uuid,
  arguments jsonb not null default '{}'::jsonb
    check (jsonb_typeof(arguments) = 'object'),
  preview jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preview) = 'object'),
  argument_hash text not null,
  confirmation_token_hash text not null,
  risk_level text not null
    check (risk_level in ('low','medium','high','critical')),
  requires_confirmation boolean not null default true,
  requires_step_up boolean not null default false,
  status text not null default 'proposed'
    check (status in (
      'proposed','confirmed','rejected','expired','executing',
      'completed','failed','cancelled'
    )),
  idempotency_key text not null,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  outcome jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  constraint assistant_action_proposals_conversation_org_fkey
    foreign key (conversation_id, org_id)
    references public.assistant_conversations(id, org_id)
    on delete cascade,
  constraint assistant_action_proposals_run_org_fkey
    foreign key (run_id, org_id)
    references public.assistant_runs(id, org_id)
    on delete set null,
  constraint assistant_action_proposals_tool_org_fkey
    foreign key (tool_call_id, org_id)
    references public.assistant_tool_calls(id, org_id)
    on delete set null
);

create unique index if not exists uq_assistant_action_proposal_idempotency
  on public.assistant_action_proposals (
    org_id, requested_by_user_id, action_type, idempotency_key
  );

create table if not exists public.assistant_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  operation_scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','failed')),
  response_redacted jsonb,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, actor_user_id, operation_scope, idempotency_key)
);

create table if not exists public.assistant_security_audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  run_id uuid references public.assistant_runs(id) on delete set null,
  tool_call_id uuid references public.assistant_tool_calls(id) on delete set null,
  proposal_id uuid references public.assistant_action_proposals(id) on delete set null,
  event_type text not null,
  action text,
  target_type text,
  target_id uuid,
  outcome text not null,
  decision_reason text,
  request_id text,
  idempotency_key text,
  before_redacted jsonb,
  after_redacted jsonb,
  details_redacted jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_assistant_conversations_actor
  on public.assistant_conversations (org_id, created_by_user_id, updated_at desc);
create index if not exists idx_assistant_messages_conversation
  on public.assistant_messages (conversation_id, created_at);
create index if not exists idx_assistant_runs_conversation
  on public.assistant_runs (conversation_id, created_at desc);
create index if not exists idx_assistant_tool_calls_run
  on public.assistant_tool_calls (run_id, created_at);
create index if not exists idx_assistant_proposals_actor_status
  on public.assistant_action_proposals (
    org_id, requested_by_user_id, status, expires_at
  );
create index if not exists idx_assistant_idempotency_expiry
  on public.assistant_idempotency_keys (expires_at);
create index if not exists idx_assistant_audit_org_time
  on public.assistant_security_audit_events (org_id, occurred_at desc);
create index if not exists idx_assistant_audit_actor_time
  on public.assistant_security_audit_events (actor_user_id, occurred_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_tool_calls enable row level security;
alter table public.assistant_feedback enable row level security;
alter table public.assistant_action_proposals enable row level security;
alter table public.assistant_idempotency_keys enable row level security;
alter table public.assistant_security_audit_events enable row level security;

create or replace function public.assistant_owns_conversation(
  p_conversation_id uuid,
  p_org_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assistant_conversations c
    where c.id = p_conversation_id
      and (p_org_id is null or c.org_id = p_org_id)
      and c.created_by_user_id = auth.uid()
      and public.is_active_org_principal(c.org_id)
  )
$$;

revoke all on function public.assistant_owns_conversation(uuid, uuid)
  from public, anon;
grant execute on function public.assistant_owns_conversation(uuid, uuid)
  to authenticated;

drop policy if exists "actor_select_assistant_conversations"
  on public.assistant_conversations;
create policy "actor_select_assistant_conversations"
  on public.assistant_conversations
  for select
  to authenticated
  using (
    created_by_user_id = auth.uid()
    and public.is_active_org_principal(org_id)
  );

drop policy if exists "actor_insert_assistant_conversations"
  on public.assistant_conversations;
create policy "actor_insert_assistant_conversations"
  on public.assistant_conversations
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and public.is_active_org_principal(org_id)
    and (
      partner_id is null
      or public.is_partner_self(partner_id)
    )
  );

drop policy if exists "actor_update_assistant_conversations"
  on public.assistant_conversations;
create policy "actor_update_assistant_conversations"
  on public.assistant_conversations
  for update
  to authenticated
  using (
    created_by_user_id = auth.uid()
    and public.is_active_org_principal(org_id)
  )
  with check (
    created_by_user_id = auth.uid()
    and public.is_active_org_principal(org_id)
  );

drop policy if exists "actor_select_assistant_messages"
  on public.assistant_messages;
create policy "actor_select_assistant_messages"
  on public.assistant_messages
  for select
  to authenticated
  using (public.assistant_owns_conversation(conversation_id, org_id));

drop policy if exists "actor_insert_user_assistant_messages"
  on public.assistant_messages;
create policy "actor_insert_user_assistant_messages"
  on public.assistant_messages
  for insert
  to authenticated
  with check (
    role = 'user'
    and created_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_select_assistant_runs"
  on public.assistant_runs;
create policy "actor_select_assistant_runs"
  on public.assistant_runs
  for select
  to authenticated
  using (
    requested_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_select_assistant_tool_calls"
  on public.assistant_tool_calls;
create policy "actor_select_assistant_tool_calls"
  on public.assistant_tool_calls
  for select
  to authenticated
  using (
    requested_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_select_assistant_feedback"
  on public.assistant_feedback;
create policy "actor_select_assistant_feedback"
  on public.assistant_feedback
  for select
  to authenticated
  using (
    created_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_insert_assistant_feedback"
  on public.assistant_feedback;
create policy "actor_insert_assistant_feedback"
  on public.assistant_feedback
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_update_assistant_feedback"
  on public.assistant_feedback;
create policy "actor_update_assistant_feedback"
  on public.assistant_feedback
  for update
  to authenticated
  using (
    created_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  )
  with check (
    created_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_delete_assistant_feedback"
  on public.assistant_feedback;
create policy "actor_delete_assistant_feedback"
  on public.assistant_feedback
  for delete
  to authenticated
  using (
    created_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_select_assistant_action_proposals"
  on public.assistant_action_proposals;
create policy "actor_select_assistant_action_proposals"
  on public.assistant_action_proposals
  for select
  to authenticated
  using (
    requested_by_user_id = auth.uid()
    and public.assistant_owns_conversation(conversation_id, org_id)
  );

drop policy if exists "actor_select_assistant_idempotency"
  on public.assistant_idempotency_keys;
create policy "actor_select_assistant_idempotency"
  on public.assistant_idempotency_keys
  for select
  to authenticated
  using (
    actor_user_id = auth.uid()
    and public.is_active_org_principal(org_id)
  );

drop policy if exists "admin_select_assistant_security_audit"
  on public.assistant_security_audit_events;
create policy "admin_select_assistant_security_audit"
  on public.assistant_security_audit_events
  for select
  to authenticated
  using (
    public.is_active_org_staff(org_id, array['owner','manager'])
  );

-- ============================================================
-- Hashing, audit, proposal confirmation, and idempotency helpers
-- ============================================================

create or replace function public.assistant_action_argument_hash(
  p_action_type text,
  p_arguments jsonb,
  p_target_type text default null,
  p_target_id uuid default null
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'action_type', p_action_type,
          'target_type', p_target_type,
          'target_id', p_target_id,
          'arguments', coalesce(p_arguments, '{}'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function public.assistant_write_security_audit(
  p_org_id uuid,
  p_event_type text,
  p_action text,
  p_outcome text,
  p_context jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.assistant_security_audit_events (
    org_id,
    actor_user_id,
    conversation_id,
    run_id,
    tool_call_id,
    proposal_id,
    event_type,
    action,
    target_type,
    target_id,
    outcome,
    decision_reason,
    request_id,
    idempotency_key,
    before_redacted,
    after_redacted,
    details_redacted
  ) values (
    p_org_id,
    coalesce(nullif(p_context->>'actor_user_id', '')::uuid, auth.uid()),
    nullif(p_context->>'conversation_id', '')::uuid,
    nullif(p_context->>'run_id', '')::uuid,
    nullif(p_context->>'tool_call_id', '')::uuid,
    nullif(p_context->>'proposal_id', '')::uuid,
    p_event_type,
    p_action,
    p_context->>'target_type',
    nullif(p_context->>'target_id', '')::uuid,
    p_outcome,
    p_context->>'decision_reason',
    p_context->>'request_id',
    p_context->>'idempotency_key',
    p_context->'before_redacted',
    p_context->'after_redacted',
    coalesce(p_context->'details_redacted', '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.assistant_create_action_proposal(
  p_org_id uuid,
  p_conversation_id uuid,
  p_action_type text,
  p_arguments jsonb,
  p_preview jsonb,
  p_idempotency_key text,
  p_run_id uuid default null,
  p_tool_call_id uuid default null,
  p_target_type text default null,
  p_target_id uuid default null,
  p_ttl_seconds integer default 600
)
returns table (
  proposal_id uuid,
  confirmation_token text,
  argument_hash text,
  proposal_expires_at timestamptz,
  proposal_requires_step_up boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cap public.assistant_capabilities%rowtype;
  v_role text;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
  v_proposal public.assistant_action_proposals%rowtype;
begin
  perform public.resolve_request_org(p_org_id, true);

  if v_actor is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if not public.assistant_owns_conversation(p_conversation_id, p_org_id) then
    raise exception using errcode = '42501', message = 'Conversation access denied';
  end if;

  select * into v_cap
  from public.assistant_capabilities c
  where c.action_type = p_action_type
    and c.enabled;

  if not found then
    raise exception using errcode = '42501', message = 'Assistant capability is not enabled';
  end if;

  v_role := public.current_user_org_role(p_org_id);
  if v_role is null then
    if not (v_cap.allow_partner and public.is_active_org_partner(p_org_id)) then
      raise exception using errcode = '42501', message = 'Capability is not available to this principal';
    end if;
  elsif not (v_role = any (v_cap.allowed_roles)) then
    raise exception using errcode = '42501', message = 'Role is not allowed to propose this action';
  end if;

  if p_arguments is null or jsonb_typeof(p_arguments) <> 'object' then
    raise exception using errcode = '22023', message = 'Action arguments must be a JSON object';
  end if;

  if p_preview is null or jsonb_typeof(p_preview) <> 'object' then
    raise exception using errcode = '22023', message = 'Action preview must be a JSON object';
  end if;

  if p_idempotency_key is null
     or char_length(p_idempotency_key) < 8
     or char_length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'Invalid proposal idempotency key';
  end if;

  if p_run_id is not null and not exists (
    select 1
    from public.assistant_runs r
    where r.id = p_run_id
      and r.org_id = p_org_id
      and r.conversation_id = p_conversation_id
      and r.requested_by_user_id = v_actor
  ) then
    raise exception using errcode = '42501', message = 'Run access denied';
  end if;

  if p_tool_call_id is not null and not exists (
    select 1
    from public.assistant_tool_calls tc
    where tc.id = p_tool_call_id
      and tc.org_id = p_org_id
      and tc.conversation_id = p_conversation_id
      and tc.requested_by_user_id = v_actor
  ) then
    raise exception using errcode = '42501', message = 'Tool call access denied';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := public.assistant_action_argument_hash(
    p_action_type, p_arguments, p_target_type, p_target_id
  );
  v_expires_at := pg_catalog.now()
    + pg_catalog.make_interval(secs => greatest(60, least(p_ttl_seconds, 3600)));

  begin
    insert into public.assistant_action_proposals (
      org_id,
      conversation_id,
      run_id,
      tool_call_id,
      requested_by_user_id,
      action_type,
      target_type,
      target_id,
      arguments,
      preview,
      argument_hash,
      confirmation_token_hash,
      risk_level,
      requires_confirmation,
      requires_step_up,
      status,
      idempotency_key,
      expires_at
    ) values (
      p_org_id,
      p_conversation_id,
      p_run_id,
      p_tool_call_id,
      v_actor,
      p_action_type,
      p_target_type,
      p_target_id,
      p_arguments,
      p_preview,
      v_hash,
      pg_catalog.encode(
        extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
        'hex'
      ),
      v_cap.risk_level,
      v_cap.requires_confirmation,
      v_cap.requires_step_up,
      'proposed',
      p_idempotency_key,
      v_expires_at
    )
    returning * into v_proposal;
  exception when unique_violation then
    select * into v_proposal
    from public.assistant_action_proposals ap
    where ap.org_id = p_org_id
      and ap.requested_by_user_id = v_actor
      and ap.action_type = p_action_type
      and ap.idempotency_key = p_idempotency_key
    for update;

    if v_proposal.argument_hash <> v_hash then
      raise exception using
        errcode = '22023',
        message = 'Proposal idempotency key was reused with different arguments';
    end if;

    if v_proposal.status = 'proposed' then
      update public.assistant_action_proposals
      set confirmation_token_hash = pg_catalog.encode(
            extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
            'hex'
          ),
          expires_at = v_expires_at,
          updated_at = pg_catalog.now()
      where id = v_proposal.id
      returning * into v_proposal;
    else
      -- A confirmed/executed proposal is intentionally not issued a new token.
      v_token := null;
    end if;
  end;

  perform public.assistant_write_security_audit(
    p_org_id,
    'action_proposal',
    p_action_type,
    'proposed',
    jsonb_build_object(
      'actor_user_id', v_actor,
      'conversation_id', p_conversation_id,
      'run_id', p_run_id,
      'tool_call_id', p_tool_call_id,
      'proposal_id', v_proposal.id,
      'target_type', p_target_type,
      'target_id', p_target_id,
      'idempotency_key', p_idempotency_key,
      'details_redacted', jsonb_build_object(
        'risk_level', v_cap.risk_level,
        'requires_confirmation', v_cap.requires_confirmation,
        'requires_step_up', v_cap.requires_step_up,
        'argument_hash', v_hash
      )
    )
  );

  return query
  select
    v_proposal.id,
    v_token,
    v_proposal.argument_hash,
    v_proposal.expires_at,
    v_proposal.requires_step_up;
end;
$$;

create or replace function public.assistant_confirm_action(
  p_proposal_id uuid,
  p_confirmation_token text,
  p_expected_argument_hash text
)
returns table (
  proposal_id uuid,
  proposal_status text,
  proposal_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.assistant_action_proposals%rowtype;
  v_token_hash text;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select * into v_proposal
  from public.assistant_action_proposals ap
  where ap.id = p_proposal_id
  for update;

  if not found
     or v_proposal.requested_by_user_id <> v_actor
     or not public.assistant_owns_conversation(
       v_proposal.conversation_id, v_proposal.org_id
     ) then
    raise exception using errcode = '42501', message = 'Proposal access denied';
  end if;

  if v_proposal.status <> 'proposed' then
    raise exception using errcode = '55000', message = 'Proposal is not awaiting confirmation';
  end if;

  if v_proposal.expires_at <= pg_catalog.now() then
    update public.assistant_action_proposals
    set status = 'expired', updated_at = pg_catalog.now()
    where id = v_proposal.id;
    raise exception using errcode = '57014', message = 'Proposal has expired';
  end if;

  if p_expected_argument_hash is distinct from v_proposal.argument_hash then
    raise exception using errcode = '22023', message = 'Proposal arguments changed';
  end if;

  v_token_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(coalesce(p_confirmation_token, ''), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  if v_token_hash <> v_proposal.confirmation_token_hash then
    raise exception using errcode = '42501', message = 'Invalid confirmation token';
  end if;

  if v_proposal.requires_step_up
     and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception using errcode = '42501', message = 'Step-up authentication is required';
  end if;

  update public.assistant_action_proposals
  set status = 'confirmed',
      confirmed_at = pg_catalog.now(),
      confirmed_by_user_id = v_actor,
      confirmation_token_hash = '',
      updated_at = pg_catalog.now()
  where id = v_proposal.id
  returning * into v_proposal;

  perform public.assistant_write_security_audit(
    v_proposal.org_id,
    'action_confirmation',
    v_proposal.action_type,
    'confirmed',
    jsonb_build_object(
      'actor_user_id', v_actor,
      'conversation_id', v_proposal.conversation_id,
      'run_id', v_proposal.run_id,
      'tool_call_id', v_proposal.tool_call_id,
      'proposal_id', v_proposal.id,
      'target_type', v_proposal.target_type,
      'target_id', v_proposal.target_id,
      'idempotency_key', v_proposal.idempotency_key,
      'details_redacted', jsonb_build_object(
        'argument_hash', v_proposal.argument_hash,
        'aal', coalesce(auth.jwt()->>'aal', 'unknown')
      )
    )
  );

  return query
  select v_proposal.id, v_proposal.status, v_proposal.confirmed_at;
end;
$$;

create or replace function public.assistant_reject_action(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.assistant_action_proposals%rowtype;
begin
  select * into v_proposal
  from public.assistant_action_proposals ap
  where ap.id = p_proposal_id
  for update;

  if not found
     or v_actor is null
     or v_proposal.requested_by_user_id <> v_actor
     or not public.assistant_owns_conversation(
       v_proposal.conversation_id, v_proposal.org_id
     ) then
    raise exception using errcode = '42501', message = 'Proposal access denied';
  end if;

  if v_proposal.status not in ('proposed','confirmed') then
    raise exception using errcode = '55000', message = 'Proposal cannot be rejected';
  end if;

  update public.assistant_action_proposals
  set status = 'rejected',
      confirmation_token_hash = '',
      updated_at = pg_catalog.now()
  where id = v_proposal.id;

  perform public.assistant_write_security_audit(
    v_proposal.org_id,
    'action_confirmation',
    v_proposal.action_type,
    'rejected',
    jsonb_build_object(
      'actor_user_id', v_actor,
      'conversation_id', v_proposal.conversation_id,
      'proposal_id', v_proposal.id,
      'target_type', v_proposal.target_type,
      'target_id', v_proposal.target_id,
      'idempotency_key', v_proposal.idempotency_key
    )
  );
end;
$$;

create or replace function public.assistant_begin_idempotency(
  p_org_id uuid,
  p_actor_user_id uuid,
  p_operation_scope text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.assistant_idempotency_keys
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.assistant_idempotency_keys%rowtype;
  v_inserted boolean := false;
begin
  if p_idempotency_key is null
     or char_length(p_idempotency_key) < 8
     or char_length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'Invalid idempotency key';
  end if;

  insert into public.assistant_idempotency_keys (
    org_id, actor_user_id, operation_scope, idempotency_key,
    request_hash, status
  ) values (
    p_org_id, p_actor_user_id, p_operation_scope, p_idempotency_key,
    p_request_hash, 'in_progress'
  )
  on conflict (org_id, actor_user_id, operation_scope, idempotency_key)
    do nothing;

  get diagnostics v_inserted = row_count;

  select * into v_row
  from public.assistant_idempotency_keys i
  where i.org_id = p_org_id
    and i.actor_user_id = p_actor_user_id
    and i.operation_scope = p_operation_scope
    and i.idempotency_key = p_idempotency_key
  for update;

  if v_row.request_hash <> p_request_hash then
    raise exception using
      errcode = '22023',
      message = 'Idempotency key was reused with different arguments';
  end if;

  if not v_inserted and v_row.status = 'in_progress' then
    raise exception using errcode = '55000', message = 'Operation is already in progress';
  end if;

  if v_row.status = 'failed' then
    update public.assistant_idempotency_keys
    set status = 'in_progress',
        response_redacted = null,
        resource_type = null,
        resource_id = null,
        updated_at = pg_catalog.now()
    where id = v_row.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.assistant_finish_idempotency(
  p_id uuid,
  p_response_redacted jsonb,
  p_resource_type text,
  p_resource_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.assistant_idempotency_keys
  set status = 'completed',
      response_redacted = p_response_redacted,
      resource_type = p_resource_type,
      resource_id = p_resource_id,
      updated_at = pg_catalog.now()
  where id = p_id
$$;

create or replace function public.assistant_require_confirmed_action(
  p_proposal_id uuid,
  p_org_id uuid,
  p_actor_user_id uuid,
  p_action_type text,
  p_expected_argument_hash text
)
returns public.assistant_action_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.assistant_action_proposals%rowtype;
begin
  select * into v_proposal
  from public.assistant_action_proposals ap
  where ap.id = p_proposal_id
  for update;

  if not found
     or v_proposal.org_id <> p_org_id
     or v_proposal.requested_by_user_id <> p_actor_user_id
     or v_proposal.action_type <> p_action_type then
    raise exception using errcode = '42501', message = 'Confirmed action does not match this command';
  end if;

  if v_proposal.status <> 'confirmed'
     or v_proposal.confirmed_by_user_id <> p_actor_user_id then
    raise exception using errcode = '42501', message = 'Human confirmation is required';
  end if;

  if v_proposal.expires_at <= pg_catalog.now() then
    raise exception using errcode = '57014', message = 'Confirmed action has expired';
  end if;

  if v_proposal.argument_hash <> p_expected_argument_hash then
    raise exception using errcode = '22023', message = 'Confirmed arguments do not match command arguments';
  end if;

  update public.assistant_action_proposals
  set status = 'executing',
      updated_at = pg_catalog.now()
  where id = v_proposal.id
  returning * into v_proposal;

  return v_proposal;
end;
$$;

create or replace function public.assistant_finish_action(
  p_proposal_id uuid,
  p_outcome jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.assistant_action_proposals
  set status = 'completed',
      outcome = p_outcome,
      executed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = p_proposal_id
    and status = 'executing'
$$;

-- Internal helpers are callable only from owner-executed definer functions.
revoke all on function public.assistant_write_security_audit(
  uuid, text, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.assistant_begin_idempotency(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.assistant_finish_idempotency(
  uuid, jsonb, text, uuid
) from public, anon, authenticated;
revoke all on function public.assistant_require_confirmed_action(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.assistant_finish_action(uuid, jsonb)
  from public, anon, authenticated;

revoke all on function public.assistant_action_argument_hash(
  text, jsonb, text, uuid
) from public, anon;
revoke all on function public.assistant_create_action_proposal(
  uuid, uuid, text, jsonb, jsonb, text, uuid, uuid, text, uuid, integer
) from public, anon;
revoke all on function public.assistant_confirm_action(uuid, text, text)
  from public, anon;
revoke all on function public.assistant_reject_action(uuid)
  from public, anon;

grant execute on function public.assistant_action_argument_hash(
  text, jsonb, text, uuid
) to authenticated;
grant execute on function public.assistant_create_action_proposal(
  uuid, uuid, text, jsonb, jsonb, text, uuid, uuid, text, uuid, integer
) to authenticated;
grant execute on function public.assistant_confirm_action(uuid, text, text)
  to authenticated;
grant execute on function public.assistant_reject_action(uuid)
  to authenticated;

-- ============================================================
-- Explicit table privileges
-- ============================================================

revoke all on table public.assistant_capabilities from public, anon, authenticated;
revoke all on table public.assistant_conversations from public, anon, authenticated;
revoke all on table public.assistant_messages from public, anon, authenticated;
revoke all on table public.assistant_runs from public, anon, authenticated;
revoke all on table public.assistant_tool_calls from public, anon, authenticated;
revoke all on table public.assistant_feedback from public, anon, authenticated;
revoke all on table public.assistant_action_proposals from public, anon, authenticated;
revoke all on table public.assistant_idempotency_keys from public, anon, authenticated;
revoke all on table public.assistant_security_audit_events from public, anon, authenticated;

grant select on table public.assistant_capabilities to authenticated;
grant select, insert, update on table public.assistant_conversations to authenticated;
grant select, insert on table public.assistant_messages to authenticated;
grant select on table public.assistant_runs to authenticated;
grant select on table public.assistant_tool_calls to authenticated;
grant select, insert, update, delete on table public.assistant_feedback to authenticated;
grant select on table public.assistant_action_proposals to authenticated;
grant select on table public.assistant_idempotency_keys to authenticated;
grant select on table public.assistant_security_audit_events to authenticated;

grant all on table public.assistant_capabilities to service_role;
grant all on table public.assistant_conversations to service_role;
grant all on table public.assistant_messages to service_role;
grant all on table public.assistant_runs to service_role;
grant all on table public.assistant_tool_calls to service_role;
grant all on table public.assistant_feedback to service_role;
grant all on table public.assistant_action_proposals to service_role;
grant all on table public.assistant_idempotency_keys to service_role;
grant all on table public.assistant_security_audit_events to service_role;
grant usage, select on sequence public.assistant_security_audit_events_id_seq
  to service_role;

comment on table public.assistant_messages is
  'Conversation content. Never store access tokens, confirmation tokens, or signed URLs.';
comment on column public.assistant_tool_calls.arguments_redacted is
  'Redacted/audit-safe arguments only; raw tool arguments stay in the short-lived executor context.';
comment on table public.assistant_action_proposals is
  'Human-confirmable action envelope bound to actor, tenant, canonical argument hash, and expiry.';
comment on table public.assistant_security_audit_events is
  'Append-only server-generated AI security audit trail; no authenticated INSERT policy exists.';
