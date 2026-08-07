/*
  Defensive convergence: revoke legacy open storage policies.

  Every policy dropped here was already removed by earlier migrations:
    - anon_* on vehicle-documents: dropped in 20260721144309 and 20260721144753
    - auth_* (bucket-only checks, no org scoping): dropped in
      20260727113000_storage_org_scoping.sql and again in
      20260727211000_business_security_hardening.sql

  On a database that has applied those migrations this is a no-op. It exists
  to converge live state in case any of these names were ever re-created by
  hand in the Supabase dashboard, where they would silently OR around the
  org-scoped org_* policies. The active role-aware org_* policies from
  20260727211000 are not touched.
*/

-- Legacy anonymous policies (only ever created for vehicle-documents, but
-- dropped for every bucket family in case of manual re-creation).
drop policy if exists "anon_upload_vehicle_documents" on storage.objects;
drop policy if exists "anon_read_vehicle_documents" on storage.objects;
drop policy if exists "anon_delete_vehicle_documents" on storage.objects;
drop policy if exists "anon_upload_finance_proofs" on storage.objects;
drop policy if exists "anon_read_finance_proofs" on storage.objects;
drop policy if exists "anon_delete_finance_proofs" on storage.objects;
drop policy if exists "anon_upload_vehicle_photos" on storage.objects;
drop policy if exists "anon_read_vehicle_photos" on storage.objects;
drop policy if exists "anon_delete_vehicle_photos" on storage.objects;

-- Legacy any-authenticated-user policies (bucket_id check only, no org scoping).
drop policy if exists "auth_upload_vehicle_documents" on storage.objects;
drop policy if exists "auth_read_vehicle_documents" on storage.objects;
drop policy if exists "auth_delete_vehicle_documents" on storage.objects;
drop policy if exists "auth_upload_finance_proofs" on storage.objects;
drop policy if exists "auth_read_finance_proofs" on storage.objects;
drop policy if exists "auth_delete_finance_proofs" on storage.objects;
drop policy if exists "auth_upload_vehicle_photos" on storage.objects;
drop policy if exists "auth_read_vehicle_photos" on storage.objects;
drop policy if exists "auth_delete_vehicle_photos" on storage.objects;
