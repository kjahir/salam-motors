/*
# Narrow public vehicle-passport read path

The tenant-table RLS cutover intentionally removes the historical allow-all
anonymous policies.  A security-invoker view can no longer read those tables
for an anonymous caller, so the public passport needs a deliberately narrow
definer boundary.

This function:
- accepts one exact, bounded public listing slug;
- returns only buyer-facing columns (no organization or vehicle identifiers);
- requires an active listing, active organization, and non-deleted vehicle;
- exposes document status only, never document paths;
- has a fixed empty search path and no default PUBLIC execute privilege.
*/

create or replace function public.get_public_vehicle_passport(
  p_public_slug text
)
returns table (
  public_slug text,
  asking_price numeric,
  description text,
  stock_number text,
  category text,
  manufacturer text,
  model text,
  variant text,
  fuel_type text,
  colour text,
  manufacture_year integer,
  registration_number text,
  odometer integer,
  owner_count integer,
  registration_city text,
  registration_state text,
  inspection_date timestamptz,
  inspection_type text,
  accident_status text,
  summary text,
  inspector_name text,
  inspection_items jsonb,
  documents jsonb,
  organization_name text
)
language sql
stable
strict
security definer
set search_path = ''
set row_security = off
as $$
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
    coalesce(items.items, '[]'::jsonb),
    coalesce(docs.documents, '[]'::jsonb),
    o.name
  from public.listings l
  join public.vehicles v
    on v.org_id = l.org_id
   and v.id = l.vehicle_id
   and v.deleted_at is null
  join public.organizations o
    on o.id = l.org_id
   and o.status = 'active'
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
    order by i.inspection_date desc, i.id desc
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
      )
      order by ii.category
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
      )
      order by d.document_type
    ) as documents
    from public.vehicle_documents d
    where d.org_id = v.org_id
      and d.vehicle_id = v.id
      and d.deleted_at is null
  ) docs on true
  where l.status = 'Active'
    and l.public_slug = p_public_slug
    and char_length(p_public_slug) between 1 and 100
    and p_public_slug = pg_catalog.btrim(p_public_slug)
  limit 1
$$;

revoke all on function public.get_public_vehicle_passport(text)
  from public, anon, authenticated;
grant execute on function public.get_public_vehicle_passport(text)
  to anon, authenticated;

-- The function above is now the only anonymous passport boundary.
revoke all on table public.vehicle_passport_public
  from public, anon, authenticated;

comment on function public.get_public_vehicle_passport(text) is
  'Returns one curated, currently published vehicle passport by exact public slug without granting anonymous access to tenant tables.';
