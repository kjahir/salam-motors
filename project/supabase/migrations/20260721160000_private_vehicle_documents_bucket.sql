/*
# Make vehicle-documents bucket private

## Overview
The `vehicle-documents` bucket was created as `public = true` and has stayed
that way through the auth/ownership hardening pass in
20260721144753_add_auth_user_ownership_rls.sql (which restricted INSERT and
DELETE to `authenticated` but explicitly left the bucket public because
"public URL reads continue without a SELECT policy").

That is a real exposure: this bucket stores identity documents (Aadhaar/PAN/
Passport/Driving License scans, per the "Seller identity" / "Buyer identity"
document types) alongside RC books, insurance, and bills. A public bucket
serves any object to anyone who has or guesses its URL, with no auth check
at all — no RLS policy can restrict that, because public buckets bypass
storage RLS for reads entirely.

## Changes
1. Flip the bucket to `public = false`.
2. Add a SELECT policy on `storage.objects` scoped to `authenticated` (same
   scope already used for the existing INSERT/DELETE policies on this
   bucket), so authenticated staff can still generate signed URLs to view
   documents, but no one else can read the bucket at all.

## Frontend impact
Reads must switch from `getPublicUrl()` (which no longer serves anything
once the bucket is private) to `createSignedUrl()`, which requires an
authenticated session — already true for every user of this app after the
prior auth migration. See src/pages/VehicleDetail.tsx's DocumentsTab.
*/

UPDATE storage.buckets SET public = false WHERE id = 'vehicle-documents';

DROP POLICY IF EXISTS "auth_read_vehicle_documents" ON storage.objects;
CREATE POLICY "auth_read_vehicle_documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-documents');
