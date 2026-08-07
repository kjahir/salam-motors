/*
# Business-data security and integrity hardening

Closes security gaps that would otherwise be amplified by an assistant:
- creator attribution no longer owns/cascades organization data;
- aggregate cardinality matches current application assumptions;
- soft-delete transitions have their own permission check;
- private storage permissions align with table roles;
- compliance evaluation cannot mistake RLS-hidden finance rows for zero rows;
- financial summaries are denied rather than returning plausible zero costs;
- public passports ignore soft-deleted document metadata.

All changes are additive or replace existing functions/views/policies with
the same public signatures.
*/

-- ============================================================
-- Correct two optional composite references from the control-plane
-- migration. Deleting runs/tool calls independently is not an application
-- operation, so NO ACTION is safer than nulling the tenant key.
-- ============================================================

alter table public.assistant_action_proposals
  drop constraint if exists assistant_action_proposals_run_org_fkey;
alter table public.assistant_action_proposals
  add constraint assistant_action_proposals_run_org_fkey
  foreign key (run_id, org_id)
  references public.assistant_runs(id, org_id);

alter table public.assistant_action_proposals
  drop constraint if exists assistant_action_proposals_tool_org_fkey;
alter table public.assistant_action_proposals
  add constraint assistant_action_proposals_tool_org_fkey
  foreign key (tool_call_id, org_id)
  references public.assistant_tool_calls(id, org_id);

-- Correctly capture INSERT row count as an integer before converting it to
-- the boolean "did this invocation claim the key?" flag.
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
  v_row_count bigint := 0;
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

  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count = 1;

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

revoke all on function public.assistant_begin_idempotency(
  uuid, uuid, text, text, text
) from public, anon, authenticated;

-- ============================================================
-- Creator attribution must not own organization data
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'vehicles', 'partners', 'parties', 'purchases', 'purchase_payments',
    'sales', 'sale_payments', 'expenses', 'investments', 'inspections',
    'inspection_items', 'vehicle_documents', 'vehicle_media', 'listings',
    'enquiries', 'alerts', 'audit_logs', 'vehicle_status_history',
    'vehicle_profit_share_allocations', 'profit_distributions',
    'mechanic_inspection_feedback', 'profit_settlement_payments',
    'compliance_policies'
  ];
  fk_name text;
begin
  foreach t in array tables loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t
        and c.column_name = 'user_id'
    ) then
      fk_name := t || '_user_id_fkey';
      execute format(
        'alter table public.%I alter column user_id drop not null',
        t
      );
      execute format(
        'alter table public.%I drop constraint if exists %I',
        t, fk_name
      );
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete set null not valid',
        t, fk_name
      );
      execute format(
        'alter table public.%I validate constraint %I',
        t, fk_name
      );
    end if;
  end loop;
end
$$;

-- Partner portal linkage is access metadata, not durable ownership.
alter table public.partners
  drop constraint if exists partners_auth_user_id_fkey;
alter table public.partners
  add constraint partners_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

alter table public.memberships
  drop constraint if exists memberships_invited_by_fkey;
alter table public.memberships
  add constraint memberships_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null;

-- ============================================================
-- Aggregate cardinality used by .maybeSingle() and finance views
-- ============================================================

do $$
begin
  if to_regclass('public.uq_purchases_org_vehicle') is null then
    if exists (
      select 1
      from public.purchases
      group by org_id, vehicle_id
      having count(*) > 1
    ) then
      raise warning
        'Skipped uq_purchases_org_vehicle: duplicate purchases require manual resolution';
    else
      create unique index uq_purchases_org_vehicle
        on public.purchases (org_id, vehicle_id);
    end if;
  end if;

  if to_regclass('public.uq_listings_org_vehicle') is null then
    if exists (
      select 1
      from public.listings
      group by org_id, vehicle_id
      having count(*) > 1
    ) then
      raise warning
        'Skipped uq_listings_org_vehicle: duplicate listings require manual resolution';
    else
      create unique index uq_listings_org_vehicle
        on public.listings (org_id, vehicle_id);
    end if;
  end if;

  if to_regclass('public.uq_sales_org_vehicle_completed') is null then
    if exists (
      select 1
      from public.sales
      where status = 'Completed'
      group by org_id, vehicle_id
      having count(*) > 1
    ) then
      raise warning
        'Skipped uq_sales_org_vehicle_completed: duplicate completed sales require manual resolution';
    else
      create unique index uq_sales_org_vehicle_completed
        on public.sales (org_id, vehicle_id)
        where status = 'Completed';
    end if;
  end if;

  if to_regclass('public.uq_profit_distributions_sale_partner') is null then
    if exists (
      select 1
      from public.profit_distributions
      where sale_id is not null
      group by org_id, sale_id, partner_id
      having count(*) > 1
    ) then
      raise warning
        'Skipped uq_profit_distributions_sale_partner: duplicate distributions require manual resolution';
    else
      create unique index uq_profit_distributions_sale_partner
        on public.profit_distributions (org_id, sale_id, partner_id)
        where sale_id is not null;
    end if;
  end if;
end
$$;

-- ============================================================
-- Soft-delete transition guard
-- ============================================================

create or replace function public.enforce_business_soft_delete_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.org_id is distinct from new.org_id then
    raise exception using errcode = '42501', message = 'Organization cannot be changed';
  end if;

  if old.deleted_at is distinct from new.deleted_at then
    if auth.uid() is null
       or not public.is_active_org_staff(
         old.org_id, array['owner','manager']
       ) then
      raise exception using
        errcode = '42501',
        message = 'Owner or manager role is required to archive or restore this record';
    end if;

    if tg_table_name = 'vehicles'
       and old.deleted_at is null
       and new.deleted_at is not null
       and old.current_status in ('SOLD','DELIVERED') then
      raise exception using
        errcode = '55000',
        message = 'Sold or delivered vehicles cannot be archived';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_business_soft_delete_transition()
  from public, anon, authenticated;

drop trigger if exists trg_soft_delete_vehicles on public.vehicles;
create trigger trg_soft_delete_vehicles
before update on public.vehicles
for each row execute function public.enforce_business_soft_delete_transition();

drop trigger if exists trg_soft_delete_expenses on public.expenses;
create trigger trg_soft_delete_expenses
before update on public.expenses
for each row execute function public.enforce_business_soft_delete_transition();

drop trigger if exists trg_soft_delete_parties on public.parties;
create trigger trg_soft_delete_parties
before update on public.parties
for each row execute function public.enforce_business_soft_delete_transition();

drop trigger if exists trg_soft_delete_partners on public.partners;
create trigger trg_soft_delete_partners
before update on public.partners
for each row execute function public.enforce_business_soft_delete_transition();

drop trigger if exists trg_soft_delete_compliance_policies
  on public.compliance_policies;
create trigger trg_soft_delete_compliance_policies
before update on public.compliance_policies
for each row execute function public.enforce_business_soft_delete_transition();

drop trigger if exists trg_soft_delete_vehicle_documents
  on public.vehicle_documents;
create trigger trg_soft_delete_vehicle_documents
before update on public.vehicle_documents
for each row execute function public.enforce_business_soft_delete_transition();

drop trigger if exists trg_soft_delete_vehicle_media on public.vehicle_media;
create trigger trg_soft_delete_vehicle_media
before update on public.vehicle_media
for each row execute function public.enforce_business_soft_delete_transition();

-- ============================================================
-- Storage policies aligned to business roles
-- ============================================================

-- Drop both historical and current names so this migration is rerunnable.
drop policy if exists "auth_upload_vehicle_documents" on storage.objects;
drop policy if exists "auth_read_vehicle_documents" on storage.objects;
drop policy if exists "auth_delete_vehicle_documents" on storage.objects;
drop policy if exists "org_upload_vehicle_documents" on storage.objects;
drop policy if exists "org_read_vehicle_documents" on storage.objects;
drop policy if exists "org_delete_vehicle_documents" on storage.objects;

drop policy if exists "auth_upload_finance_proofs" on storage.objects;
drop policy if exists "auth_read_finance_proofs" on storage.objects;
drop policy if exists "auth_delete_finance_proofs" on storage.objects;
drop policy if exists "org_upload_finance_proofs" on storage.objects;
drop policy if exists "org_read_finance_proofs" on storage.objects;
drop policy if exists "org_delete_finance_proofs" on storage.objects;

drop policy if exists "auth_upload_vehicle_photos" on storage.objects;
drop policy if exists "auth_read_vehicle_photos" on storage.objects;
drop policy if exists "auth_delete_vehicle_photos" on storage.objects;
drop policy if exists "org_upload_vehicle_photos" on storage.objects;
drop policy if exists "org_read_vehicle_photos" on storage.objects;
drop policy if exists "org_delete_vehicle_photos" on storage.objects;

create policy "org_upload_vehicle_documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-documents'
  and public.safe_uuid((storage.foldername(name))[1]) is not null
  and public.is_active_org_staff(
    public.safe_uuid((storage.foldername(name))[1]),
    array['owner','manager','mechanic_inspector']
  )
);

create policy "org_read_vehicle_documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-documents'
  and (
    public.is_active_org_staff(
      public.safe_uuid((storage.foldername(name))[1])
    )
    or (
      public.safe_uuid((storage.foldername(name))[1]) is null
      and public.is_active_org_staff(
        (select o.id from public.organizations o order by o.created_at limit 1)
      )
    )
  )
);

create policy "org_delete_vehicle_documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-documents'
  and (
    public.is_active_org_staff(
      public.safe_uuid((storage.foldername(name))[1]),
      array['owner','manager']
    )
    or (
      public.safe_uuid((storage.foldername(name))[1]) is null
      and public.is_active_org_staff(
        (select o.id from public.organizations o order by o.created_at limit 1),
        array['owner','manager']
      )
    )
  )
);

create policy "org_upload_vehicle_photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-photos'
  and public.safe_uuid((storage.foldername(name))[1]) is not null
  and public.is_active_org_staff(
    public.safe_uuid((storage.foldername(name))[1]),
    array['owner','manager','sales_executive','mechanic_inspector']
  )
);

create policy "org_read_vehicle_photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-photos'
  and (
    public.is_active_org_staff(
      public.safe_uuid((storage.foldername(name))[1])
    )
    or (
      public.safe_uuid((storage.foldername(name))[1]) is null
      and public.is_active_org_staff(
        (select o.id from public.organizations o order by o.created_at limit 1)
      )
    )
  )
);

create policy "org_delete_vehicle_photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-photos'
  and (
    public.is_active_org_staff(
      public.safe_uuid((storage.foldername(name))[1]),
      array['owner','manager']
    )
    or (
      public.safe_uuid((storage.foldername(name))[1]) is null
      and public.is_active_org_staff(
        (select o.id from public.organizations o order by o.created_at limit 1),
        array['owner','manager']
      )
    )
  )
);

create policy "org_upload_finance_proofs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'finance-proofs'
  and public.safe_uuid((storage.foldername(name))[1]) is not null
  and (
    (
      (storage.foldername(name))[2] in ('purchase-payments','expenses')
      and public.is_active_org_staff(
        public.safe_uuid((storage.foldername(name))[1]),
        array['owner','manager','accountant']
      )
    )
    or (
      (storage.foldername(name))[2] in ('investments','settlements')
      and public.is_active_org_staff(
        public.safe_uuid((storage.foldername(name))[1]),
        array['owner','accountant']
      )
    )
  )
);

create policy "org_read_finance_proofs"
on storage.objects for select to authenticated
using (
  bucket_id = 'finance-proofs'
  and (
    public.is_active_org_staff(
      public.safe_uuid((storage.foldername(name))[1]),
      array['owner','manager','accountant']
    )
    or (
      public.safe_uuid((storage.foldername(name))[1]) is null
      and public.is_active_org_staff(
        (select o.id from public.organizations o order by o.created_at limit 1),
        array['owner','manager','accountant']
      )
    )
  )
);

create policy "org_delete_finance_proofs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'finance-proofs'
  and (
    public.is_active_org_staff(
      public.safe_uuid((storage.foldername(name))[1]),
      array['owner','manager']
    )
    or (
      public.safe_uuid((storage.foldername(name))[1]) is null
      and public.is_active_org_staff(
        (select o.id from public.organizations o order by o.created_at limit 1),
        array['owner','manager']
      )
    )
  )
);

-- No UPDATE policies are created: object overwrite/move is deliberately not
-- a browser capability. Upload a new random object and update the owning row.

-- ============================================================
-- Compliance rule validation and trusted evaluation
-- ============================================================

create or replace function public.validate_compliance_policy_shape()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tolerance numeric;
begin
  if jsonb_typeof(new.params) <> 'object' then
    raise exception using errcode = '22023', message = 'Compliance params must be a JSON object';
  end if;

  if new.category not in (
    'document','financial_evidence','financial_reconciliation'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported compliance category';
  end if;

  if new.severity not in ('Info','Warning','High','Critical') then
    raise exception using errcode = '22023', message = 'Unsupported compliance severity';
  end if;

  if new.rule_type = 'document_required' then
    if coalesce(new.params->>'document_type', '') = '' then
      raise exception using errcode = '22023', message = 'document_type is required';
    end if;
    if new.params ? 'accepted_statuses'
       and jsonb_typeof(new.params->'accepted_statuses') <> 'array' then
      raise exception using errcode = '22023', message = 'accepted_statuses must be an array';
    end if;
  elsif new.rule_type = 'evidence_required' then
    if coalesce(new.params->>'entity', '') not in (
      'purchase_payment','expense','investment'
    ) then
      raise exception using errcode = '22023', message = 'Unsupported evidence entity';
    end if;
  elsif new.rule_type = 'amount_reconciliation' then
    if coalesce(
      new.params->>'target',
      'purchase_payments_vs_purchase_price'
    ) <> 'purchase_payments_vs_purchase_price' then
      raise exception using errcode = '22023', message = 'Unsupported reconciliation target';
    end if;
    begin
      v_tolerance := coalesce((new.params->>'tolerance')::numeric, 0.01);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'tolerance must be numeric';
    end;
    if v_tolerance < 0 then
      raise exception using errcode = '22023', message = 'tolerance cannot be negative';
    end if;
  else
    raise exception using errcode = '22023', message = 'Unsupported compliance rule type';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_compliance_policy_shape
  on public.compliance_policies;
create trigger trg_validate_compliance_policy_shape
before insert or update of category, rule_type, params, severity
on public.compliance_policies
for each row execute function public.validate_compliance_policy_shape();

create or replace function public.is_policy_violated(
  p_vehicle_id uuid,
  p_policy public.compliance_policies
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_policy public.compliance_policies%rowtype;
begin
  select v.org_id into v_org_id
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.deleted_at is null;

  if v_org_id is null
     or not public.is_active_org_staff(v_org_id) then
    return false;
  end if;

  select cp.* into v_policy
  from public.compliance_policies cp
  where cp.id = p_policy.id
    and cp.org_id = v_org_id
    and cp.is_active
    and cp.deleted_at is null;

  if not found then
    return false;
  end if;

  if v_policy.rule_type = 'document_required' then
    return not exists (
      select 1
      from public.vehicle_documents d
      where d.org_id = v_org_id
        and d.vehicle_id = p_vehicle_id
        and d.deleted_at is null
        and d.document_type = v_policy.params->>'document_type'
        and d.verification_status = any (
          case when v_policy.params ? 'accepted_statuses'
            then array(
              select jsonb_array_elements_text(
                v_policy.params->'accepted_statuses'
              )
            )
            else array['Verified','Uploaded']
          end
        )
    );
  elsif v_policy.rule_type = 'evidence_required' then
    if v_policy.params->>'entity' = 'purchase_payment' then
      return exists (
        select 1
        from public.purchase_payments pp
        join public.purchases pu
          on pu.id = pp.purchase_id
         and pu.org_id = pp.org_id
        where pu.org_id = v_org_id
          and pu.vehicle_id = p_vehicle_id
          and (
            pp.proof_urls is null
            or cardinality(pp.proof_urls) = 0
          )
      );
    elsif v_policy.params->>'entity' = 'expense' then
      return exists (
        select 1
        from public.expenses e
        where e.org_id = v_org_id
          and e.vehicle_id = p_vehicle_id
          and e.deleted_at is null
          and e.approval_status not in ('Draft','Rejected','Reversed')
          and (
            e.bill_urls is null
            or cardinality(e.bill_urls) = 0
          )
      );
    elsif v_policy.params->>'entity' = 'investment' then
      return exists (
        select 1
        from public.investments i
        where i.org_id = v_org_id
          and i.vehicle_id = p_vehicle_id
          and (
            i.proof_urls is null
            or cardinality(i.proof_urls) = 0
          )
      );
    end if;
    return false;
  elsif v_policy.rule_type = 'amount_reconciliation' then
    return exists (
      select 1
      from public.purchases pu
      left join (
        select pp.org_id, pp.purchase_id, sum(pp.amount) as paid
        from public.purchase_payments pp
        where pp.org_id = v_org_id
        group by pp.org_id, pp.purchase_id
      ) pp
        on pp.purchase_id = pu.id
       and pp.org_id = pu.org_id
      where pu.org_id = v_org_id
        and pu.vehicle_id = p_vehicle_id
        and abs(
          coalesce(pp.paid, 0)
          - (
            pu.agreed_price
            + pu.broker_commission
            + pu.other_fee
          )
        ) > coalesce((v_policy.params->>'tolerance')::numeric, 0.01)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.is_policy_violated(
  uuid, public.compliance_policies
) from public, anon;
grant execute on function public.is_policy_violated(
  uuid, public.compliance_policies
) to authenticated;

create or replace function public.protect_compliance_alert_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolution_mode text;
begin
  if old.org_id is distinct from new.org_id
     or old.vehicle_id is distinct from new.vehicle_id
     or old.alert_type is distinct from new.alert_type
     or old.policy_id is distinct from new.policy_id then
    raise exception using
      errcode = '42501',
      message = 'Alert identity and tenant fields are immutable';
  end if;

  if old.alert_type = 'Compliance'
     and old.status is distinct from new.status
     and new.status = 'Resolved' then
    if not public.is_active_org_staff(
      old.org_id, array['owner','manager','accountant']
    ) then
      raise exception using
        errcode = '42501',
        message = 'Finance-capable role required to resolve compliance alerts';
    end if;

    select cp.resolution_mode into v_resolution_mode
    from public.compliance_policies cp
    where cp.id = old.policy_id
      and cp.org_id = old.org_id;

    if v_resolution_mode = 'auto_only'
       and coalesce(
         current_setting('app.compliance_sync', true), ''
       ) <> 'on' then
      raise exception using
        errcode = '42501',
        message = 'This compliance alert can only be resolved by policy evaluation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_compliance_alert_update()
  from public, anon, authenticated;

drop trigger if exists trg_protect_compliance_alert_update
  on public.alerts;
create trigger trg_protect_compliance_alert_update
before update on public.alerts
for each row execute function public.protect_compliance_alert_update();

create or replace function public.sync_org_compliance_alerts(
  p_org_id uuid,
  p_vehicle_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_resolved bigint := 0;
  v_inserted bigint := 0;
  v_result jsonb;
begin
  perform public.resolve_request_org(p_org_id, false);
  if not public.is_active_org_staff(
    p_org_id, array['owner','manager','accountant']
  ) then
    raise exception using errcode = '42501', message = 'Role cannot synchronize compliance';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1
    from public.vehicles v
    where v.id = p_vehicle_id
      and v.org_id = p_org_id
      and v.deleted_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'Vehicle not found in organization';
  end if;

  perform pg_catalog.set_config('app.compliance_sync', 'on', true);

  with violations as materialized (
    select
      v.id as vehicle_id,
      cp.id as policy_id,
      cp.name,
      cp.category,
      cp.severity
    from public.vehicles v
    join public.compliance_policies cp
      on cp.org_id = v.org_id
     and cp.is_active
     and cp.deleted_at is null
    where v.org_id = p_org_id
      and v.deleted_at is null
      and (p_vehicle_id is null or v.id = p_vehicle_id)
      and public.is_policy_violated(v.id, cp)
  ),
  resolved as (
    update public.alerts a
    set status = 'Resolved',
        resolved_at = pg_catalog.now()
    where a.org_id = p_org_id
      and a.alert_type = 'Compliance'
      and a.policy_id is not null
      and a.status in ('Open','Acknowledged')
      and (p_vehicle_id is null or a.vehicle_id = p_vehicle_id)
      and not exists (
        select 1
        from violations v
        where v.vehicle_id = a.vehicle_id
          and v.policy_id = a.policy_id
      )
    returning 1
  ),
  inserted as (
    insert into public.alerts (
      org_id,
      user_id,
      vehicle_id,
      alert_type,
      policy_id,
      severity,
      title,
      message,
      status
    )
    select
      p_org_id,
      v_actor,
      v.vehicle_id,
      'Compliance',
      v.policy_id,
      v.severity,
      v.name,
      'Compliance policy "' || v.name || '" ('
        || replace(v.category, '_', ' ')
        || ') is currently violated.',
      'Open'
    from violations v
    where not exists (
      select 1
      from public.alerts a
      where a.org_id = p_org_id
        and a.vehicle_id = v.vehicle_id
        and a.policy_id = v.policy_id
        and a.status in ('Open','Acknowledged')
    )
    on conflict do nothing
    returning 1
  )
  select
    (select count(*) from resolved),
    (select count(*) from inserted)
  into v_resolved, v_inserted;

  v_result := jsonb_build_object(
    'org_id', p_org_id,
    'vehicle_id', p_vehicle_id,
    'resolved_count', v_resolved,
    'inserted_count', v_inserted
  );

  perform public.assistant_write_security_audit(
    p_org_id,
    'compliance_sync',
    'compliance.sync',
    'completed',
    jsonb_build_object(
      'actor_user_id', v_actor,
      'target_type', case when p_vehicle_id is null then 'organization' else 'vehicle' end,
      'target_id', coalesce(p_vehicle_id, p_org_id),
      'details_redacted', v_result
    )
  );

  return v_result;
end;
$$;

revoke all on function public.sync_org_compliance_alerts(uuid, uuid)
  from public, anon;
grant execute on function public.sync_org_compliance_alerts(uuid, uuid)
  to authenticated;

-- ============================================================
-- Financial summary: deny unauthorized roles instead of deriving
-- plausible profits from RLS-filtered zero cost rows.
-- ============================================================

create or replace view public.vehicle_financial_summary as
select
  v.id as vehicle_id,
  v.stock_number,
  v.current_status,
  v.asking_price,
  v.minimum_price,
  coalesce(p.agreed_price, 0)
    + coalesce(p.broker_commission, 0)
    + coalesce(p.other_fee, 0) as purchase_cost,
  coalesce(e.refurb, 0) as refurbishment_cost,
  coalesce(e.holding, 0) as holding_cost,
  coalesce(e.logistics, 0) as logistics_cost,
  coalesce(e.docs_selling, 0) as documentation_selling_cost,
  coalesce(e.other, 0) as other_cost,
  coalesce(e.total, 0) as total_expense,
  (
    coalesce(p.agreed_price, 0)
    + coalesce(p.broker_commission, 0)
    + coalesce(p.other_fee, 0)
    + coalesce(e.total, 0)
  ) as total_vehicle_cost,
  coalesce(s.sale_price, 0) as sale_price,
  coalesce(s.discount, 0) as discount,
  coalesce(s.buyer_charges, 0) as buyer_charges,
  coalesce(s.net_revenue, 0) as net_sale_revenue,
  case when s.sale_price is not null then
    coalesce(s.net_revenue, 0) - (
      coalesce(p.agreed_price, 0)
      + coalesce(p.broker_commission, 0)
      + coalesce(p.other_fee, 0)
      + coalesce(e.total, 0)
    )
    else null
  end as gross_profit,
  case when v.asking_price is not null then
    v.asking_price - (
      coalesce(p.agreed_price, 0)
      + coalesce(p.broker_commission, 0)
      + coalesce(p.other_fee, 0)
      + coalesce(e.total, 0)
    )
    else null
  end as estimated_profit,
  coalesce(inv.total_invested, 0) as total_invested
from public.vehicles v
left join (
  select
    pu.org_id,
    pu.vehicle_id,
    pu.agreed_price,
    pu.broker_commission,
    pu.other_fee
  from public.purchases pu
) p on p.org_id = v.org_id and p.vehicle_id = v.id
left join (
  select
    ex.org_id,
    ex.vehicle_id,
    sum(ex.amount) filter (
      where ex.category in (
        'Spare parts','Mechanic labour','Service','Cleaning and detailing'
      )
    ) as refurb,
    sum(ex.amount) filter (where ex.category = 'Yard rent') as holding,
    sum(ex.amount) filter (
      where ex.category in ('Transportation','Fuel','Test ride')
    ) as logistics,
    sum(ex.amount) filter (
      where ex.category in (
        'Document transfer','Insurance','PUC',
        'Advertisement','Broker commission'
      )
    ) as docs_selling,
    sum(ex.amount) filter (
      where ex.category in ('Penalty or fine','Other')
    ) as other,
    sum(ex.amount) as total
  from public.expenses ex
  where ex.approval_status in ('Approved','Paid')
    and ex.deleted_at is null
  group by ex.org_id, ex.vehicle_id
) e on e.org_id = v.org_id and e.vehicle_id = v.id
left join (
  select
    sa.org_id,
    sa.vehicle_id,
    sa.sale_price,
    sa.discount,
    sa.buyer_charges,
    sa.sale_price + sa.buyer_charges - sa.discount as net_revenue
  from public.sales sa
  where sa.status = 'Completed'
) s on s.org_id = v.org_id and s.vehicle_id = v.id
left join (
  select
    i.org_id,
    i.vehicle_id,
    sum(i.amount) as total_invested
  from public.investments i
  where i.status in ('Received','Partially used','Fully used')
  group by i.org_id, i.vehicle_id
) inv on inv.org_id = v.org_id and inv.vehicle_id = v.id
where public.is_active_org_staff(
  v.org_id, array['owner','manager','accountant']
);

alter view public.vehicle_financial_summary set (security_invoker = true);

-- ============================================================
-- Public passport: keep projection stable, exclude soft-deleted docs
-- ============================================================

create or replace view public.vehicle_passport_public as
select
  l.public_slug,
  l.asking_price,
  l.description,
  v.stock_number,
  v.category,
  v.manufacturer,
  v.model,
  v.variant,
  v.fuel_type,
  v.colour,
  v.manufacture_year,
  v.registration_number,
  v.odometer,
  v.owner_count,
  v.registration_city,
  v.registration_state,
  li.inspection_date,
  li.inspection_type,
  li.accident_status,
  li.summary,
  li.inspector_name,
  coalesce(items.items, '[]'::jsonb) as inspection_items,
  coalesce(docs.documents, '[]'::jsonb) as documents,
  v.org_id,
  o.name as organization_name
from public.vehicles v
join public.listings l
  on l.org_id = v.org_id
 and l.vehicle_id = v.id
 and l.status = 'Active'
left join public.organizations o on o.id = v.org_id
left join lateral (
  select
    i.id,
    i.inspection_date,
    i.inspection_type,
    i.accident_status,
    i.summary,
    i.inspector_name
  from public.inspections i
  where i.org_id = v.org_id
    and i.vehicle_id = v.id
  order by i.inspection_date desc
  limit 1
) li on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'category', ii.category,
      'score', ii.score,
      'condition_level', ii.condition_level,
      'recommended_action', ii.recommended_action,
      'weight', ii.weight
    ) order by ii.category
  ) as items
  from public.inspection_items ii
  where ii.org_id = v.org_id
    and ii.inspection_id = li.id
) items on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'document_type', d.document_type,
      'verification_status', d.verification_status
    ) order by d.document_type
  ) as documents
  from public.vehicle_documents d
  where d.org_id = v.org_id
    and d.vehicle_id = v.id
    and d.deleted_at is null
) docs on true
where v.deleted_at is null;

grant select on public.vehicle_passport_public to anon, authenticated;

comment on function public.sync_org_compliance_alerts(uuid, uuid) is
  'Trusted, explicit-org compliance synchronization. Ordinary reads should never call client-side mutating sync.';
comment on function public.enforce_business_soft_delete_transition() is
  'Backstop for UPDATE-based archive/restore so UPDATE permission cannot bypass DELETE role policy.';
