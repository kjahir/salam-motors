/*
# Backfill org_id across all business tables

## Overview
Second step of the multi-org migration (see 20260727090000 for
organizations/memberships/helper functions). Adds `org_id` to every
table that currently carries an owner `user_id`, backfills every existing
row to the single organization seeded in the previous migration, then
makes the column NOT NULL with a default of `current_org_id()`.

No RLS policy is touched in this migration - every table's existing
owner-scoped (`auth.uid() = user_id`) policies remain the live security
boundary until the cutover migration. This migration is safe to run and
verify on its own before that happens.

`user_id` is left untouched everywhere - it keeps meaning "who created
this row" (audit trail), it just stops being the RLS gate once the
cutover migration lands.

## Tables affected
vehicles, partners, parties, purchases, purchase_payments, sales,
sale_payments, expenses, investments, inspections, inspection_items,
vehicle_documents, vehicle_media, listings, enquiries, alerts, audit_logs,
vehicle_status_history, vehicle_profit_share_allocations,
profit_distributions, mechanic_inspection_feedback,
profit_settlement_payments, compliance_policies

`partners` additionally gets `auth_user_id`, ahead of the partner
self-service portal - nullable, populated only when a partner is invited
to log in. `is_partner_self()` is defined right after that column exists,
for the same reason.
*/

-- ============================================================
-- Step 1: Add org_id (nullable) to every business table
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
begin
  foreach t in array tables loop
    execute format('alter table public.%I add column if not exists org_id uuid references public.organizations(id)', t);
  end loop;
end $$;

alter table public.partners add column if not exists auth_user_id uuid references auth.users(id);
create unique index if not exists uq_partners_auth_user on public.partners (auth_user_id) where auth_user_id is not null;

-- `is_partner_self()` lives here (not in 20260727090000) because it depends
-- on partners.auth_user_id, which didn't exist until the column add above.
create or replace function public.is_partner_self(p_partner_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.partners p
    where p.id = p_partner_id and p.auth_user_id = auth.uid()
      and p.deleted_at is null and p.status = 'active'
  );
$$;
grant execute on function public.is_partner_self(uuid) to authenticated;

-- ============================================================
-- Step 2: Backfill every existing row to the single seeded org
-- ============================================================
do $$
declare
  t text;
  v_org_id uuid;
  tables text[] := array[
    'vehicles', 'partners', 'parties', 'purchases', 'purchase_payments',
    'sales', 'sale_payments', 'expenses', 'investments', 'inspections',
    'inspection_items', 'vehicle_documents', 'vehicle_media', 'listings',
    'enquiries', 'alerts', 'audit_logs', 'vehicle_status_history',
    'vehicle_profit_share_allocations', 'profit_distributions',
    'mechanic_inspection_feedback', 'profit_settlement_payments',
    'compliance_policies'
  ];
begin
  select id into v_org_id from public.organizations order by created_at asc limit 1;

  if v_org_id is null then
    raise exception 'No organization found - run 20260727090000_multi_org_membership_schema.sql first';
  end if;

  foreach t in array tables loop
    execute format('update public.%I set org_id = $1 where org_id is null', t) using v_org_id;
  end loop;
end $$;

-- ============================================================
-- Step 3: NOT NULL + default + index
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
begin
  foreach t in array tables loop
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('alter table public.%I alter column org_id set default public.current_org_id()', t);
    execute format('create index if not exists idx_%I_org_id on public.%I (org_id)', t, t);
  end loop;
end $$;
