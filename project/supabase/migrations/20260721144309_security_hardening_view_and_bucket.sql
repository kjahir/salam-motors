/*
# Security hardening: view security invoker + storage bucket listing

## Overview
Addresses two genuine security findings without breaking the single-tenant
no-auth app:

1. Security Definer View — `vehicle_financial_summary` was created with the
   default SECURITY DEFINER property, so it ran with the view owner's
   privileges and bypassed the caller's RLS. Switched to `security_invoker =
   true` so the view executes with the invoking role's permissions and
   respects RLS on the underlying tables.

2. Public Bucket Allows Listing — the `vehicle-documents` public bucket had a
   broad SELECT policy (`anon_read_vehicle_documents`) on `storage.objects`
   that let any client enumerate every file in the bucket via the `list()` API.
   Public buckets serve objects directly via their public URL without any
   SELECT policy, so this policy only exposed the ability to list. Dropped it.
   Upload (INSERT) and DELETE policies are retained so the app can still
   upload and remove documents; public URL reads continue to work.

## What is NOT changed and why
The remaining findings ("RLS Policy Always True" on every table's
INSERT/UPDATE/DELETE) are intentional for this app's architecture. This is a
single-tenant, no-auth operational demo: there is no `auth.users` link, no
`user_id` ownership column, and no sign-in screen. The frontend talks to
Supabase entirely with the anon key, so every read AND write runs as the
`anon` role. Per the single-tenant no-auth RLS model, `USING (true)` /
`WITH CHECK (true)` with `TO anon, authenticated` is the correct design — it
is the only way the anon-key client can read and write its own shared data.

Converting these to ownership-based predicates would require adding
authentication (a `user_id` column on every table, `auth.uid()` checks, and a
sign-in/sign-up UI so an authenticated session exists). Restricting writes to
`authenticated` only — without adding auth — would silently break every
create/update/delete in the app, since the anon-key client has no session.
That is the classic "app looks empty / can't save" RLS failure.

If full scanner compliance is required, the path is to add email/password
auth to the app and rescope all policies to `auth.uid()` ownership. That is a
larger change and should be done deliberately, not as a side effect of this
hardening pass.

## Security changes
- `ALTER VIEW public.vehicle_financial_summary SET (security_invoker = true)`
- `DROP POLICY anon_read_vehicle_documents ON storage.objects`
*/

-- 1. View: switch from SECURITY DEFINER (default) to SECURITY INVOKER
ALTER VIEW public.vehicle_financial_summary SET (security_invoker = true);

-- 2. Storage: drop the broad SELECT/listing policy on the public bucket.
--    Public URL reads still work without it; only the list() API is removed.
DROP POLICY IF EXISTS "anon_read_vehicle_documents" ON storage.objects;
