-- Application-wide assistant operational controls.

create or replace function public.assistant_acknowledge_alert(
  p_org_id uuid,
  p_alert_id uuid
)
returns table (
  id uuid,
  vehicle_id uuid,
  title text,
  status text,
  acknowledged_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_cap public.assistant_capabilities%rowtype;
  v_alert public.alerts%rowtype;
  v_actor_email text;
begin
  perform public.resolve_request_org(p_org_id, true);
  if v_actor is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select * into v_cap
  from public.assistant_capabilities c
  where c.action_type = 'alert.acknowledge'
    and c.enabled;
  if not found then
    raise exception using errcode = '42501', message = 'Assistant capability is not enabled';
  end if;

  v_role := public.current_user_org_role(p_org_id);
  if v_role is null or not (v_role = any(v_cap.allowed_roles)) then
    raise exception using errcode = '42501', message = 'Capability is not available to this principal';
  end if;

  select * into v_alert
  from public.alerts a
  where a.id = p_alert_id
    and a.org_id = p_org_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Alert not found';
  end if;
  if v_alert.status <> 'Open' then
    raise exception using errcode = '55000', message = 'Alert is not open';
  end if;

  update public.alerts a
  set status = 'Acknowledged', acknowledged_at = now()
  where a.id = p_alert_id and a.org_id = p_org_id
  returning a.* into v_alert;

  select u.email into v_actor_email from auth.users u where u.id = v_actor;
  insert into public.audit_logs (
    org_id, user_id, entity_type, entity_id, action,
    old_value, new_value, performed_by, reason, source,
    changed_fields, db_txid
  ) values (
    p_org_id, v_actor, 'alerts', p_alert_id, 'acknowledged',
    jsonb_build_object('status', 'Open'),
    jsonb_build_object('status', v_alert.status, 'acknowledged_at', v_alert.acknowledged_at),
    coalesce(v_actor_email, v_actor::text),
    'Alert acknowledged through the AI assistant', 'assistant',
    array['status', 'acknowledged_at'], txid_current()
  );

  perform public.assistant_write_security_audit(
    p_org_id,
    'action_execution',
    'alert.acknowledge',
    'completed',
    jsonb_build_object(
      'actor_user_id', v_actor,
      'target_type', 'alert',
      'target_id', p_alert_id,
      'after_redacted', jsonb_build_object('status', v_alert.status)
    )
  );

  return query select
    v_alert.id,
    v_alert.vehicle_id,
    v_alert.title,
    v_alert.status,
    v_alert.acknowledged_at;
end;
$$;

revoke all on function public.assistant_acknowledge_alert(uuid, uuid)
  from public, anon;
grant execute on function public.assistant_acknowledge_alert(uuid, uuid)
  to authenticated;

comment on function public.assistant_acknowledge_alert(uuid, uuid) is
  'Capability-gated, role-checked, tenant-scoped assistant alert acknowledgement with business and security audit records.';
