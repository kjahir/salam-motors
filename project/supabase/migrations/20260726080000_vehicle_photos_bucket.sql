/*
# Vehicle photos storage bucket

## Overview
`vehicle_media` has existed in the schema since day one (photo/video/audio
metadata per vehicle, already RLS-hardened to be owner-scoped like every
other table) but nothing has ever used it — no bucket, no queries, no UI.
This adds the storage side so a vehicle photo gallery can be built on top
of it, reusing the existing upload (FileUploadGrid) and viewer (Lightbox)
components already used for documents/finance proofs.

## Changes
1. `vehicle-photos` storage bucket — private, same posture as
   `vehicle-documents` and `finance-proofs` (authenticated-only, signed
   URLs for reads — no public bucket).
*/

INSERT INTO storage.buckets (id, name, public)
  VALUES ('vehicle-photos', 'vehicle-photos', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_vehicle_photos" ON storage.objects;
CREATE POLICY "auth_upload_vehicle_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos');

DROP POLICY IF EXISTS "auth_read_vehicle_photos" ON storage.objects;
CREATE POLICY "auth_read_vehicle_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-photos');

DROP POLICY IF EXISTS "auth_delete_vehicle_photos" ON storage.objects;
CREATE POLICY "auth_delete_vehicle_photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-photos');
