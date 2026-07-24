/*
# Public vehicle passport view

## Overview
The frontend (Passport.tsx) already builds a shareable URL —
`{origin}/passport/{listing.public_slug}` — meant for buyers to open
without logging in. It never worked: there was no route for it, and even
if there were, the auth/ownership hardening pass
(20260721144753_add_auth_user_ownership_rls.sql) scopes every table's
RLS to `auth.uid() = user_id`, so an anonymous visitor gets zero rows
from `vehicles`, `listings`, `inspections`, etc. regardless.

This migration adds a single, narrow, read-only view that exposes only
the fields the passport UI actually renders — vehicle identity/specs,
the public listing price/description, the latest inspection summary and
its component scores, and document type + verification status (never
the file itself, document number, or issuer). It deliberately excludes
everything ownership-sensitive: purchase price, expenses, investments,
profit distributions, seller/buyer identity, and all storage file paths.

Because the view has no `security_invoker`, it runs with the privileges
of its owner (the migration role), which bypasses the per-owner RLS on
the underlying tables — that's required here since a listing should be
publicly visible regardless of which staff `user_id` created it. The
view's own WHERE clause is therefore the only gate, and it admits only
rows whose listing status is 'Active'.

## Frontend
A public route reads this view by `public_slug`. No update path is
added here — publishing/unpublishing (setting `listings.status`) stays
an authenticated, RLS-protected action in the app.
*/

CREATE OR REPLACE VIEW public.vehicle_passport_public AS
SELECT
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
  COALESCE(items.items, '[]'::jsonb) AS inspection_items,
  COALESCE(docs.documents, '[]'::jsonb) AS documents
FROM public.vehicles v
JOIN public.listings l ON l.vehicle_id = v.id AND l.status = 'Active'
LEFT JOIN LATERAL (
  SELECT i.id, i.inspection_date, i.inspection_type, i.accident_status, i.summary, i.inspector_name
  FROM public.inspections i
  WHERE i.vehicle_id = v.id
  ORDER BY i.inspection_date DESC
  LIMIT 1
) li ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'category', ii.category,
      'score', ii.score,
      'condition_level', ii.condition_level,
      'recommended_action', ii.recommended_action,
      'weight', ii.weight
    ) ORDER BY ii.category
  ) AS items
  FROM public.inspection_items ii
  WHERE ii.inspection_id = li.id
) items ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'document_type', d.document_type,
      'verification_status', d.verification_status
    ) ORDER BY d.document_type
  ) AS documents
  FROM public.vehicle_documents d
  WHERE d.vehicle_id = v.id
) docs ON true;

GRANT SELECT ON public.vehicle_passport_public TO anon, authenticated;
