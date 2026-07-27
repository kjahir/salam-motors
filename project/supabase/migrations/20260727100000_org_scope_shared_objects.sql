/*
# Re-scope shared/global objects to org_id

## Overview
Third step of the multi-org migration. A handful of objects were built as
deliberately global (bypassing the old per-owner RLS on purpose, per their
own migration comments) because they needed to be either (a) inherently
cross-user - `next_stock_number()`, `check_registration_available()`,
`vehicle_passport_public` - or (b) a genuinely shared business-wide
resource - `app_settings`. Now that `organizations` exists, "global"
should mean "global within an org", not "global across every dealership
that will ever use this app".

- `stock_number_counters` / `next_stock_number()`: counter becomes
  per-(org, year) instead of per-year. Call site
  (`src/lib/queries.ts` -> `nextStockNumber()`) is unchanged - it calls
  the RPC with zero arguments either way, the function resolves the org
  internally via `current_org_id()`.
- `check_registration_available()`: registration-number uniqueness
  becomes per-org rather than global. Two unrelated dealerships legitimately
  handling the same physical vehicle at different times is realistic, and
  a global check would leak "this reg number exists somewhere" across
  tenants. Call site unchanged (still `(reg_number, exclude_vehicle_id)`).
- `app_settings`: singleton-per-app becomes singleton-per-org. PK changes
  from `id boolean` to `org_id uuid`. `select_app_settings`/`update_app_settings`
  policies (previously `USING (true)` - any authenticated user, any org)
  become org-membership-checked.
- `vehicle_passport_public`: gains `org_id` in the select list for
  defense-in-depth. `listings.public_slug` stays globally unique
  (it already embeds a UUID fragment - see `src/lib/vehicle.ts`) so the
  public route/URL shape does not change.
- `vehicle_compliance_violations`: join condition moves from
  `p.user_id = v.user_id` to `p.org_id = v.org_id`.

Depends on 20260727090000 (organizations/current_org_id) and
20260727093000 (org_id present on vehicles/compliance_policies/etc.).
*/

-- ============================================================
-- stock_number_counters: per-year -> per-(org, year)
-- ============================================================
alter table public.stock_number_counters add column if not exists org_id uuid references public.organizations(id);

update public.stock_number_counters
set org_id = (select id from public.organizations order by created_at asc limit 1)
where org_id is null;

alter table public.stock_number_counters alter column org_id set not null;
alter table public.stock_number_counters drop constraint if exists stock_number_counters_pkey;
alter table public.stock_number_counters add primary key (org_id, year);

create or replace function public.next_stock_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.current_org_id();
  yr int := extract(year from now())::int;
  next_val int;
begin
  if v_org_id is null then
    raise exception 'No active organization membership for current user';
  end if;

  insert into public.stock_number_counters (org_id, year, last_value)
  values (v_org_id, yr, 1)
  on conflict (org_id, year) do update set last_value = stock_number_counters.last_value + 1
  returning last_value into next_val;

  return 'BIKE-' || yr || '-' || lpad(next_val::text, 6, '0');
end;
$$;

-- ============================================================
-- check_registration_available(): global -> per-org
-- ============================================================
alter table public.vehicles drop constraint if exists vehicles_registration_number_active_key;
drop index if exists vehicles_registration_number_active_key;
create unique index if not exists vehicles_registration_number_org_active_key
  on public.vehicles (org_id, registration_number) where deleted_at is null;

drop index if exists vehicles_stock_number_active_key;
create unique index if not exists vehicles_stock_number_org_active_key
  on public.vehicles (org_id, stock_number) where deleted_at is null;

create or replace function public.check_registration_available(reg_number text, exclude_vehicle_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.vehicles
    where registration_number = reg_number
      and deleted_at is null
      and org_id = public.current_org_id()
      and (exclude_vehicle_id is null or id <> exclude_vehicle_id)
  );
$$;

-- ============================================================
-- app_settings: singleton-per-app -> singleton-per-org
-- ============================================================
alter table public.app_settings add column if not exists org_id uuid references public.organizations(id);

update public.app_settings
set org_id = (select id from public.organizations order by created_at asc limit 1)
where org_id is null;

alter table public.app_settings alter column org_id set not null;
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add primary key (org_id);
alter table public.app_settings drop column if exists id;

drop policy if exists "select_app_settings" on public.app_settings;
drop policy if exists "update_app_settings" on public.app_settings;

create policy "org_select_app_settings" on public.app_settings for select to authenticated
  using (public.is_org_member(org_id));
create policy "org_update_app_settings" on public.app_settings for update to authenticated
  using (public.is_org_member(org_id, array['owner', 'manager']))
  with check (public.is_org_member(org_id, array['owner', 'manager']));

-- ============================================================
-- vehicle_passport_public: add org_id for defense-in-depth
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
  v.org_id
from public.vehicles v
join public.listings l on l.vehicle_id = v.id and l.status = 'Active'
left join lateral (
  select i.id, i.inspection_date, i.inspection_type, i.accident_status, i.summary, i.inspector_name
  from public.inspections i
  where i.vehicle_id = v.id
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
  where ii.inspection_id = li.id
) items on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'document_type', d.document_type,
      'verification_status', d.verification_status
    ) order by d.document_type
  ) as documents
  from public.vehicle_documents d
  where d.vehicle_id = v.id
) docs on true
where v.deleted_at is null;

grant select on public.vehicle_passport_public to anon, authenticated;

-- ============================================================
-- vehicle_compliance_violations: user_id join -> org_id join
-- ============================================================
create or replace view public.vehicle_compliance_violations as
select
  v.id as vehicle_id,
  p.id as policy_id,
  p.name, p.category, p.severity, p.rule_type, p.params,
  is_policy_violated(v.id, p) as violated
from public.vehicles v
join public.compliance_policies p on p.org_id = v.org_id and p.is_active and p.deleted_at is null
where v.deleted_at is null;

alter view public.vehicle_compliance_violations set (security_invoker = true);

create or replace view public.vehicle_compliance_status as
select
  v.id as vehicle_id,
  coalesce(count(*) filter (where vcv.violated), 0) as violation_count,
  coalesce(max(case when vcv.violated then
    case vcv.severity when 'Critical' then 4 when 'High' then 3 when 'Warning' then 2 when 'Info' then 1 else 0 end
  end), 0) as max_severity_rank,
  coalesce(jsonb_agg(jsonb_build_object(
    'policy_id', vcv.policy_id, 'name', vcv.name, 'category', vcv.category, 'severity', vcv.severity
  )) filter (where vcv.violated), '[]'::jsonb) as violations
from public.vehicles v
left join public.vehicle_compliance_violations vcv on vcv.vehicle_id = v.id
where v.deleted_at is null
group by v.id;

alter view public.vehicle_compliance_status set (security_invoker = true);
