/*
# Soft delete for user-facing destructive actions

## Overview
A vehicle was hard-deleted via the app's "Delete Vehicle" modal today
(2026-07-26), cascading away its real purchase and expense records with no
way to recover them and no audit trail of the deletion itself (only
`created` events are logged today, in vehicle.ts / sale.ts — delete was
never wired into audit_logs).

This migration adds a `deleted_at` column to every table with a user-facing
"delete" action in the UI, so those actions can become soft deletes
(`UPDATE ... SET deleted_at = now()`) instead of hard `DELETE`s. Paired
application-code changes (this same change set) switch the delete handlers
to soft-delete + an audit_logs "deleted" entry, and add `deleted_at IS NULL`
filters to the relevant list/detail queries.

## Scope
vehicles, expenses, parties, partners, compliance_policies,
vehicle_documents, vehicle_media — every table with a real "Delete" button.

Deliberately NOT included: the internal rollback deletes in
vehicle.ts/sale.ts (createVehicle, completeSale) and the inspection-create
rollback in VehicleDetail.tsx. Those delete rows they just inserted moments
earlier when a later step in the same multi-row transaction fails — the
data was never actually live, so there's nothing to preserve or audit.

## Data handling
Adding a nullable column with no default changes no existing row — every
row gets deleted_at = NULL (= not deleted). Fully non-destructive.

## Uniqueness
vehicles.stock_number and vehicles.registration_number carried table-wide
UNIQUE constraints. A hard delete used to free that number for reuse; a
soft delete leaves the row in place, so those constraints are replaced with
partial unique indexes scoped to `WHERE deleted_at IS NULL`, preserving the
old "delete frees the number" behavior. check_registration_available() is
updated to match (it already runs SECURITY DEFINER to bypass per-owner RLS
for this global lookup, per 20260724110000_global_uniqueness_functions.sql).
*/

-- ============================================================
-- Step 1: Add deleted_at to every table with a real "Delete" action
-- ============================================================
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE compliance_policies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE vehicle_media ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ============================================================
-- Step 2: Indexes to keep "active rows" queries and soft-delete
-- lookups cheap as these tables grow
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parties_deleted_at ON parties (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_deleted_at ON partners (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_policies_deleted_at ON compliance_policies (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_deleted_at ON vehicle_documents (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_media_deleted_at ON vehicle_media (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================
-- Step 3: Replace table-wide uniqueness with "active rows only"
-- uniqueness, so a soft-deleted vehicle's stock/registration
-- number can be reused, same as a hard delete used to allow
-- ============================================================
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_stock_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_stock_number_active_key ON vehicles (stock_number) WHERE deleted_at IS NULL;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_registration_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_registration_number_active_key ON vehicles (registration_number) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.check_registration_available(reg_number text, exclude_vehicle_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM vehicles
    WHERE registration_number = reg_number
      AND deleted_at IS NULL
      AND (exclude_vehicle_id IS NULL OR id <> exclude_vehicle_id)
  );
$$;

-- ============================================================
-- Step 4: vehicle_compliance_violations / vehicle_compliance_status
-- (20260725091500_alerts_policy_link_and_compliance_views.sql) join
-- vehicles and compliance_policies directly and predate deleted_at.
-- Without this, a soft-deleted vehicle or policy would keep
-- generating/showing compliance alerts after "deletion".
-- ============================================================
CREATE OR REPLACE VIEW vehicle_compliance_violations AS
SELECT
  v.id AS vehicle_id,
  p.id AS policy_id,
  p.name, p.category, p.severity, p.rule_type, p.params,
  is_policy_violated(v.id, p) AS violated
FROM vehicles v
JOIN compliance_policies p ON p.user_id = v.user_id AND p.is_active AND p.deleted_at IS NULL
WHERE v.deleted_at IS NULL;

ALTER VIEW vehicle_compliance_violations SET (security_invoker = true);

CREATE OR REPLACE VIEW vehicle_compliance_status AS
SELECT
  v.id AS vehicle_id,
  COALESCE(COUNT(*) FILTER (WHERE vcv.violated), 0) AS violation_count,
  COALESCE(MAX(CASE WHEN vcv.violated THEN
    CASE vcv.severity WHEN 'Critical' THEN 4 WHEN 'High' THEN 3 WHEN 'Warning' THEN 2 WHEN 'Info' THEN 1 ELSE 0 END
  END), 0) AS max_severity_rank,
  COALESCE(jsonb_agg(jsonb_build_object(
    'policy_id', vcv.policy_id, 'name', vcv.name, 'category', vcv.category, 'severity', vcv.severity
  )) FILTER (WHERE vcv.violated), '[]'::jsonb) AS violations
FROM vehicles v
LEFT JOIN vehicle_compliance_violations vcv ON vcv.vehicle_id = v.id
WHERE v.deleted_at IS NULL
GROUP BY v.id;

ALTER VIEW vehicle_compliance_status SET (security_invoker = true);

-- ============================================================
-- Step 5: vehicle_passport_public (20260724103700) is a public,
-- unauthenticated view keyed off listings.status = 'Active'. It has
-- no idea about deleted_at, so a soft-deleted vehicle's public
-- passport page would otherwise stay live and publicly visible.
-- Deliberately NOT touching vehicle_financial_summary — the app
-- already treats preserving a deleted vehicle's financial history as
-- correct (DeleteVehicleModal blocks hard deletes for SOLD/DELIVERED
-- vehicles specifically to protect that history), so Reports should
-- keep showing it.
-- ============================================================
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
  WHERE d.vehicle_id = v.id AND d.deleted_at IS NULL
) docs ON true
WHERE v.deleted_at IS NULL;

GRANT SELECT ON public.vehicle_passport_public TO anon, authenticated;
