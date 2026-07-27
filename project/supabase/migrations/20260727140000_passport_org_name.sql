/*
# Dealership name on the public vehicle passport

## Overview
`vehicle_passport_public` (the anonymous, buyer-facing view) already
carries `org_id` (20260727100000) but not the dealership's actual name,
so the passport page's "Verified by ..." trust badge was still hardcoded
to "Salam Motors" in the frontend regardless of which org's vehicle was
being viewed - wrong the moment a second dealership exists. Appends
`organization_name` as the view's new last column (CREATE OR REPLACE VIEW
can only append, not reorder, existing columns).
*/

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
join public.listings l on l.vehicle_id = v.id and l.status = 'Active'
left join public.organizations o on o.id = v.org_id
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
