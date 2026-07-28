/*
# Ask Salam org-wide audit visibility

The assistant control plane (20260727210000) intentionally scopes every
`actor_select_*` policy to `created_by_user_id = auth.uid()` - a user can
only read their own conversations, runs, tool calls, and proposals. That's
correct for the chat experience itself, but it means nobody (not even an
owner) can review another staff member's Ask Salam activity. The one
exception already in place is `admin_select_assistant_security_audit` on
`assistant_security_audit_events`.

This migration adds the same shape of policy - additive `for select`,
`is_active_org_staff(org_id, array['owner','manager'])` - to the five
other assistant tables, and a read-optimized function,
`admin_list_assistant_turns`, that joins them into one row per turn for
the new Audit page. Multiple permissive SELECT policies on the same table
combine with OR, so this purely adds visibility on top of the existing
actor-scoped policies; it does not narrow or replace them.
*/

-- ============================================================
-- Let the edge function's service-role client write tool-call audit
-- events directly
-- ============================================================

/*
20260727210000 deliberately left `assistant_write_security_audit` with no
grant beyond its revoke from public/anon/authenticated - the comment
above that revoke says it's "callable only from owner-executed definer
functions" (i.e. only via `perform` from inside
assistant_create_action_proposal / assistant_confirm_action /
assistant_reject_action, which run as the function owner). The Ask Salam
audit enrichment work now needs it called directly, once per tool call
(not just confirmed writes), from persistence.ts using the service-role
server client - so service_role needs its own explicit grant.
*/
grant execute on function public.assistant_write_security_audit(
  uuid, text, text, text, jsonb
) to service_role;

-- ============================================================
-- Org-wide owner/manager SELECT policies
-- ============================================================

drop policy if exists "admin_org_select_assistant_conversations"
  on public.assistant_conversations;
create policy "admin_org_select_assistant_conversations"
  on public.assistant_conversations
  for select
  to authenticated
  using (
    public.is_active_org_staff(org_id, array['owner', 'manager'])
  );

drop policy if exists "admin_org_select_assistant_messages"
  on public.assistant_messages;
create policy "admin_org_select_assistant_messages"
  on public.assistant_messages
  for select
  to authenticated
  using (
    public.is_active_org_staff(org_id, array['owner', 'manager'])
  );

drop policy if exists "admin_org_select_assistant_runs"
  on public.assistant_runs;
create policy "admin_org_select_assistant_runs"
  on public.assistant_runs
  for select
  to authenticated
  using (
    public.is_active_org_staff(org_id, array['owner', 'manager'])
  );

drop policy if exists "admin_org_select_assistant_tool_calls"
  on public.assistant_tool_calls;
create policy "admin_org_select_assistant_tool_calls"
  on public.assistant_tool_calls
  for select
  to authenticated
  using (
    public.is_active_org_staff(org_id, array['owner', 'manager'])
  );

drop policy if exists "admin_org_select_assistant_action_proposals"
  on public.assistant_action_proposals;
create policy "admin_org_select_assistant_action_proposals"
  on public.assistant_action_proposals
  for select
  to authenticated
  using (
    public.is_active_org_staff(org_id, array['owner', 'manager'])
  );

-- ============================================================
-- Read-optimized turn listing for the Audit page
-- ============================================================

/*
security invoker on purpose: this function grants no new access by
itself. It relies entirely on the five policies above (plus the existing
`select_own_membership_or_admin` policy on `memberships`) to decide what
the calling user can see. p_org_id is still applied explicitly so the
query only ever touches rows for the organization the caller asked about.
*/
create or replace function public.admin_list_assistant_turns(
  p_org_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  run_id uuid,
  conversation_id uuid,
  conversation_title text,
  requested_by_user_id uuid,
  requested_by_email text,
  status text,
  model text,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  user_message_text text,
  assistant_message_text text,
  tool_call_count bigint,
  proposal_action_type text,
  proposal_status text,
  proposal_risk_level text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    ar.id as run_id,
    ar.conversation_id,
    ac.title as conversation_title,
    ar.requested_by_user_id,
    m.email as requested_by_email,
    ar.status,
    ar.model,
    ar.started_at,
    ar.completed_at,
    ar.error_code,
    ar.error_message,
    um.content ->> 'text' as user_message_text,
    amsg.content ->> 'text' as assistant_message_text,
    coalesce(tc.tool_call_count, 0) as tool_call_count,
    ap.action_type as proposal_action_type,
    ap.status as proposal_status,
    ap.risk_level as proposal_risk_level,
    ar.created_at
  from public.assistant_runs ar
  join public.assistant_conversations ac
    on ac.id = ar.conversation_id and ac.org_id = ar.org_id
  left join public.assistant_messages um
    on um.id = ar.input_message_id and um.org_id = ar.org_id
  left join public.assistant_messages amsg
    on amsg.id = ar.output_message_id and amsg.org_id = ar.org_id
  left join public.memberships m
    on m.org_id = ar.org_id and m.user_id = ar.requested_by_user_id
  left join lateral (
    select count(*) as tool_call_count
    from public.assistant_tool_calls tc
    where tc.run_id = ar.id and tc.org_id = ar.org_id
  ) tc on true
  left join lateral (
    select ap2.action_type, ap2.status, ap2.risk_level
    from public.assistant_action_proposals ap2
    where ap2.run_id = ar.id and ap2.org_id = ar.org_id
    order by ap2.created_at desc
    limit 1
  ) ap on true
  where ar.org_id = p_org_id
  order by ar.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.admin_list_assistant_turns(uuid, integer, integer) is
  'One row per Ask Salam turn (run) for the Audit page: conversation title, requester, user/assistant text, tool-call count, and latest proposal outcome. security invoker - visibility is entirely governed by the caller''s own RLS grants.';

revoke all on function public.admin_list_assistant_turns(uuid, integer, integer)
  from public, anon;
grant execute on function public.admin_list_assistant_turns(uuid, integer, integer)
  to authenticated;
