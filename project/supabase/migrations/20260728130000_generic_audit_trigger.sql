/*
# Generic audit trigger backbone

`audit_logs` today is only ever populated by hand: every write path that
wants an audit trail has to remember to add an explicit
`insert into audit_logs (...)` alongside its real write. That's easy to
forget - and it *was* forgotten: editing a vehicle via
`EditVehicleModal.tsx` / `MobileVehicleForm.tsx` updates `vehicles`
directly with no audit_logs call at all, so those edits currently leave
zero history trail in production.

This migration adds a generic `AFTER INSERT OR UPDATE` trigger,
`public.audit_row_change()`, and attaches it to the business tables that
most need a durable trail. It does not touch or remove any of the
existing manual `audit_logs.insert(...)` call sites (in
src/lib/vehicle.ts, src/lib/sale.ts, DeleteVehicleModal.tsx,
Partners.tsx, Parties.tsx, Policies.tsx, VehicleDetail.tsx, and the
transactional assistant-command RPCs) - those keep running exactly as
before. A single logical operation (e.g. the create_vehicle_with_purchase
RPC) will now produce a manual "app"-sourced row *and* one or more
trigger-sourced rows referencing the same tables. That's an intentional,
acceptable duplication for now; `db_txid` lets a later cleanup pass group
rows from the same transaction if it wants to de-duplicate.

## What this does NOT do
- No table is dropped, renamed, or has a column removed.
- `vehicle_status_history` is intentionally left alone - it's already a
  dedicated log table; attaching a generic audit trigger to it would be
  "logging a log".
- Tables outside the list below (alerts, inspections, investments,
  enquiries, sale_payments, profit_settlement_payments, etc.) are left as
  they are; they were not called out in this pass.
*/

-- ============================================================
-- Step 1: Extend audit_logs (additive only)
-- ============================================================

alter table public.audit_logs
  add column if not exists source text not null default 'app'
    check (source in ('app', 'trigger', 'assistant', 'system'));

alter table public.audit_logs
  add column if not exists changed_fields text[];

alter table public.audit_logs
  add column if not exists db_txid bigint;

create index if not exists idx_audit_logs_db_txid
  on public.audit_logs (db_txid)
  where db_txid is not null;

comment on column public.audit_logs.source is
  'Who/what produced this row: a manual app-code insert, this generic trigger, the Ask Salam assistant, or a system/background job.';
comment on column public.audit_logs.changed_fields is
  'For action=updated rows written by the generic trigger: the set of top-level columns whose value changed (excluding updated_at).';
comment on column public.audit_logs.db_txid is
  'txid_current() at write time. Rows sharing a db_txid came from the same logical database transaction and can be grouped in the UI.';

-- ============================================================
-- Step 2: Generic trigger function
-- ============================================================

/*
Deliberately written against NEW/OLD as generic records rather than a
fixed row type, using jsonb comparisons instead of direct field access
(e.g. `NEW.deleted_at`) for anything that isn't present on every attached
table. `id` and `org_id` are the only two columns this function assumes
exist on every table it's attached to - true for all twelve tables below.
*/
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_email text;
  v_old_json jsonb;
  v_new_json jsonb;
  v_changed_fields text[];
  v_action text;
begin
  select u.email into v_actor_email
  from auth.users u
  where u.id = auth.uid();

  if TG_OP = 'INSERT' then
    insert into public.audit_logs (
      org_id, user_id, entity_type, entity_id, action,
      old_value, new_value, performed_by, source, changed_fields, db_txid
    ) values (
      NEW.org_id, auth.uid(), TG_TABLE_NAME, NEW.id, 'created',
      null, to_jsonb(NEW), coalesce(v_actor_email, 'system'),
      'trigger', null, txid_current()
    );
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    v_old_json := to_jsonb(OLD) - 'updated_at';
    v_new_json := to_jsonb(NEW) - 'updated_at';

    if v_old_json = v_new_json then
      return NEW;
    end if;

    select coalesce(array_agg(key), array[]::text[])
    into v_changed_fields
    from jsonb_each(v_new_json) as new_kv(key, value)
    where v_new_json -> key is distinct from v_old_json -> key;

    if (v_new_json ? 'deleted_at')
       and (v_old_json ->> 'deleted_at') is null
       and (v_new_json ->> 'deleted_at') is not null then
      v_action := 'deleted';
    else
      v_action := 'updated';
    end if;

    insert into public.audit_logs (
      org_id, user_id, entity_type, entity_id, action,
      old_value, new_value, performed_by, source, changed_fields, db_txid
    ) values (
      coalesce(NEW.org_id, OLD.org_id), auth.uid(), TG_TABLE_NAME, NEW.id,
      v_action, v_old_json, v_new_json, coalesce(v_actor_email, 'system'),
      'trigger', v_changed_fields, txid_current()
    );
    return NEW;
  end if;

  return NEW;
end;
$$;

comment on function public.audit_row_change() is
  'Generic AFTER INSERT/UPDATE audit trigger. Writes audit_logs with source=trigger. Skips no-op updates (identical NEW/OLD excluding updated_at).';

revoke all on function public.audit_row_change() from public, anon, authenticated;

-- ============================================================
-- Step 3: Attach to business tables
-- (verified present via `grep -n "^CREATE TABLE IF NOT EXISTS" migrations`)
-- ============================================================

drop trigger if exists trg_audit_vehicles on public.vehicles;
create trigger trg_audit_vehicles
  after insert or update on public.vehicles
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_purchases on public.purchases;
create trigger trg_audit_purchases
  after insert or update on public.purchases
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_purchase_payments on public.purchase_payments;
create trigger trg_audit_purchase_payments
  after insert or update on public.purchase_payments
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_sales on public.sales;
create trigger trg_audit_sales
  after insert or update on public.sales
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_expenses on public.expenses;
create trigger trg_audit_expenses
  after insert or update on public.expenses
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_listings on public.listings;
create trigger trg_audit_listings
  after insert or update on public.listings
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_parties on public.parties;
create trigger trg_audit_parties
  after insert or update on public.parties
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_partners on public.partners;
create trigger trg_audit_partners
  after insert or update on public.partners
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_compliance_policies on public.compliance_policies;
create trigger trg_audit_compliance_policies
  after insert or update on public.compliance_policies
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_vehicle_documents on public.vehicle_documents;
create trigger trg_audit_vehicle_documents
  after insert or update on public.vehicle_documents
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_vehicle_media on public.vehicle_media;
create trigger trg_audit_vehicle_media
  after insert or update on public.vehicle_media
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_profit_distributions on public.profit_distributions;
create trigger trg_audit_profit_distributions
  after insert or update on public.profit_distributions
  for each row execute function public.audit_row_change();

-- vehicle_status_history is intentionally NOT included above - see header.
