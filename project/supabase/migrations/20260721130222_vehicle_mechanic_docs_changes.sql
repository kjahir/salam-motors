/*
# Vehicle onboarding, mechanic parties, inspection feedback, and document storage

## Overview
Supports nine product changes:
1. Registration number becomes the primary identifier for a vehicle — NOT NULL + UNIQUE.
2. (No schema change — asking/minimum price mandatory is a UI validation only.)
3. Seller is picked from existing parties — no schema change, UI change only.
4. Multiple investing partners — no schema change needed (investments table
   already supports many rows per vehicle), UI change only.
5. New party type "Mechanic" with subtypes 'individual' | 'company_mechanic'.
6. Inspections gain an optional link to a Mechanic party (inspector).
7. New table `mechanic_inspection_feedback` for mechanic feedback per vehicle.
8. Document file uploads use a new storage bucket `vehicle-documents` + file_url.
9. (No schema change — profit color coding + loss-notes mandatory is UI only.)

## Modified Tables
1. `vehicles`
   - `registration_number` text → NOT NULL, UNIQUE constraint added.
   - Existing rows with NULL registration_number backfilled to a placeholder
     so the NOT NULL constraint can be applied without losing data.
2. `parties`
   - `party_subtype` CHECK constraint relaxed to also accept mechanic subtypes.
3. `inspections`
   - NEW column `mechanic_party_id` (uuid, nullable, REFERENCES parties(id)).

## New Tables
1. `mechanic_inspection_feedback`
   - One row per feedback note left by a mechanic about a vehicle.
   - Columns: id, vehicle_id, mechanic_party_id, inspection_id (optional),
     rating (1-5), feedback_text, areas_of_concern, recommended_actions,
     status, created_at.

## Security
- RLS enabled on `mechanic_inspection_feedback` with anon + authenticated
  full CRUD (single-tenant shared app).
- Storage bucket `vehicle-documents` created as PUBLIC for read; writes use
  the anon key (single-tenant demo).

## Notes
1. Registration number UNIQUE is enforced at the DB level so duplicates are
   rejected even if the UI check is bypassed.
2. The parties party_subtype CHECK is rewritten (drop + recreate) to be
   idempotent and to include the new mechanic values.
*/

-- ============================================================
-- 1. vehicles.registration_number: NOT NULL + UNIQUE
-- ============================================================
-- Backfill any NULL registration numbers so we can set NOT NULL.
UPDATE vehicles
  SET registration_number = 'UNKNOWN-' || id::text
  WHERE registration_number IS NULL;

ALTER TABLE vehicles
  ALTER COLUMN registration_number SET NOT NULL;

-- Drop the non-unique index if present, replace with a UNIQUE constraint.
DROP INDEX IF EXISTS idx_vehicles_reg;
ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_registration_number_key;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_registration_number_key UNIQUE (registration_number);

-- ============================================================
-- 2. parties: extend party_subtype CHECK for mechanic subtypes
-- ============================================================
ALTER TABLE parties
  DROP CONSTRAINT IF EXISTS parties_party_subtype_check;

ALTER TABLE parties
  ADD CONSTRAINT parties_party_subtype_check CHECK (
    party_subtype IS NULL
    OR (party_type = 'seller'  AND party_subtype IN ('individual', 'bank_auction'))
    OR (party_type = 'buyer'   AND party_subtype IN ('individual', 'agent'))
    OR (party_type = 'mechanic' AND party_subtype IN ('individual', 'company_mechanic'))
  );

-- Update the helper index to cover the new type.
DROP INDEX IF EXISTS idx_parties_type_subtype;
CREATE INDEX idx_parties_type_subtype
  ON parties (party_type, party_subtype);

-- ============================================================
-- 3. inspections: link to mechanic party
-- ============================================================
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS mechanic_party_id uuid REFERENCES parties(id) ON DELETE SET NULL;

-- ============================================================
-- 4. mechanic_inspection_feedback table
-- ============================================================
CREATE TABLE IF NOT EXISTS mechanic_inspection_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  mechanic_party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  inspection_id uuid REFERENCES inspections(id) ON DELETE SET NULL,
  rating int NOT NULL DEFAULT 3 CHECK (rating >= 1 AND rating <= 5),
  feedback_text text NOT NULL,
  areas_of_concern text,
  recommended_actions text,
  status text NOT NULL DEFAULT 'Submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mif_vehicle ON mechanic_inspection_feedback(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mif_mechanic ON mechanic_inspection_feedback(mechanic_party_id);

ALTER TABLE mechanic_inspection_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_mechanic_inspection_feedback" ON mechanic_inspection_feedback;
CREATE POLICY "anon_select_mechanic_inspection_feedback"
  ON mechanic_inspection_feedback FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_mechanic_inspection_feedback" ON mechanic_inspection_feedback;
CREATE POLICY "anon_insert_mechanic_inspection_feedback"
  ON mechanic_inspection_feedback FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_mechanic_inspection_feedback" ON mechanic_inspection_feedback;
CREATE POLICY "anon_update_mechanic_inspection_feedback"
  ON mechanic_inspection_feedback FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_mechanic_inspection_feedback" ON mechanic_inspection_feedback;
CREATE POLICY "anon_delete_mechanic_inspection_feedback"
  ON mechanic_inspection_feedback FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- 5. Storage bucket for document uploads
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('vehicle-documents', 'vehicle-documents', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow anon + authenticated to upload/read/list in the bucket.
DROP POLICY IF EXISTS "anon_upload_vehicle_documents" ON storage.objects;
CREATE POLICY "anon_upload_vehicle_documents"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "anon_read_vehicle_documents" ON storage.objects;
CREATE POLICY "anon_read_vehicle_documents"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "anon_delete_vehicle_documents" ON storage.objects;
CREATE POLICY "anon_delete_vehicle_documents"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'vehicle-documents');
