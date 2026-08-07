/*
# Add email/password authentication with ownership-scoped RLS

## Overview
Converts the app from single-tenant (anon-key, no auth) to multi-user
(email/password sign-in) with per-user data isolation. Every table gets a
`user_id` owner column defaulting to `auth.uid()`, and all RLS policies are
rewritten from `USING (true)` / `WITH CHECK (true)` (anon, unrestricted) to
`auth.uid() = user_id` (authenticated, owner-scoped). This makes all
"RLS Policy Always True" scanner findings go green.

## New Columns
Every table below gets `user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE`:
1.  vehicles
2.  partners
3.  parties
4.  purchases
5.  purchase_payments
6.  sales
7.  sale_payments
8.  expenses
9.  investments
10. inspections
11. inspection_items
12. vehicle_documents
13. vehicle_media
14. listings
15. enquiries
16. alerts
17. audit_logs
18. vehicle_status_history
19. vehicle_profit_share_allocations
20. profit_distributions
21. mechanic_inspection_feedback

The `DEFAULT auth.uid()` means the frontend can `.insert({ ... })` without
passing `user_id` — the database fills the owner from the authenticated
session, and the INSERT policy's `WITH CHECK (auth.uid() = user_id)` passes.

## Security Changes
- All existing `anon_*` policies (SELECT/INSERT/UPDATE/DELETE with `true`)
  are DROPPED on every table.
- 4 new owner-scoped policies per table (one per CRUD verb), all
  `TO authenticated` with `auth.uid() = user_id`:
  - SELECT: `USING (auth.uid() = user_id)`
  - INSERT: `WITH CHECK (auth.uid() = user_id)`
  - UPDATE: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
  - DELETE: `USING (auth.uid() = user_id)`
- Storage bucket `vehicle-documents`: INSERT and DELETE policies updated
  from `TO anon, authenticated` to `TO authenticated` only. Public URL
  reads continue without a SELECT policy (public bucket).
- View `vehicle_financial_summary` already switched to `security_invoker`
  in a prior migration; it now respects RLS on underlying tables automatically.

## Data Handling
- 4 existing `audit_logs` seed rows have no real owner (no auth user exists
  yet). They are deleted since they were seed/demo data with no user_id.
  All other tables are already empty.

## Important Notes
1. The frontend MUST build a sign-in/sign-up screen — without an
   authenticated session, `auth.uid()` returns NULL and every policy
   rejects all rows. The anon-key client can no longer read or write data.
2. All frontend inserts continue to omit `user_id` — the DEFAULT fills it.
3. Email confirmation remains OFF (per Supabase default for this project).
*/
-- ============================================================
-- Step 0: Seed a new auth user for the existing seed data to own
-- ============================================================
DO $$
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "confirmed_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'authenticated', 'authenticated', 'salam@gmail.com', '$2a$10$pVgxvzN/D/SeI6Tkz3LZG.2mhw1rTn4jWibdmzzbA3ea0SvfT1jYW', '2026-07-21 14:59:32.405134+00', null, '', null, '', null, '', '', null, '2026-07-28 03:04:39.282224+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', null, '2026-07-21 14:59:32.386961+00', '2026-07-28 03:04:39.315546+00', null, null, '', '', null, default, '', 0, null, '', null, false, null, false);
END $$;
-- ============================================================
-- Step 1: Add user_id column to all tables (nullable first)
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vehicles','partners','parties','purchases','purchase_payments',
    'sales','sale_payments','expenses','investments','inspections',
    'inspection_items','vehicle_documents','vehicle_media','listings',
    'enquiries','alerts','audit_logs','vehicle_status_history',
    'vehicle_profit_share_allocations','profit_distributions',
    'mechanic_inspection_feedback'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add user_id to %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Step 2: Delete seed audit_logs that have no real owner
-- (All other tables are empty)
-- ============================================================
DELETE FROM audit_logs WHERE user_id IS NULL;

-- ============================================================
-- Step 3: Set NOT NULL + DEFAULT auth.uid() on all user_id columns
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vehicles','partners','parties','purchases','purchase_payments',
    'sales','sale_payments','expenses','investments','inspections',
    'inspection_items','vehicle_documents','vehicle_media','listings',
    'enquiries','alerts','audit_logs','vehicle_status_history',
    'vehicle_profit_share_allocations','profit_distributions',
    'mechanic_inspection_feedback'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
	EXECUTE format('UPDATE public.%I SET user_id = %L WHERE user_id IS NULL', t, '03c73ded-1ef7-4d98-9910-228dcbd95b8c');    
	EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET NOT NULL', t);
	EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid()', t);
  END LOOP;
END $$;

-- ============================================================
-- Step 4: Create indexes on user_id for query performance
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vehicles','partners','parties','purchases','purchase_payments',
    'sales','sale_payments','expenses','investments','inspections',
    'inspection_items','vehicle_documents','vehicle_media','listings',
    'enquiries','alerts','audit_logs','vehicle_status_history',
    'vehicle_profit_share_allocations','profit_distributions',
    'mechanic_inspection_feedback'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_id ON public.%I (user_id)', t, t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create index on %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Step 5: Drop ALL existing anon policies and create
--          owner-scoped authenticated policies (4 per table)
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vehicles','partners','parties','purchases','purchase_payments',
    'sales','sale_payments','expenses','investments','inspections',
    'inspection_items','vehicle_documents','vehicle_media','listings',
    'enquiries','alerts','audit_logs','vehicle_status_history',
    'vehicle_profit_share_allocations','profit_distributions',
    'mechanic_inspection_feedback'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop old anon policies (all 4 verbs)
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON public.%I', t, t);

    -- Create new owner-scoped policies
    EXECUTE format('CREATE POLICY "select_own_%s" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "insert_own_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "update_own_%s" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "delete_own_%s" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t, t);
  END LOOP;
END $$;

-- ============================================================
-- Step 6: Update storage bucket policies to authenticated only
-- ============================================================
DROP POLICY IF EXISTS "anon_upload_vehicle_documents" ON storage.objects;
CREATE POLICY "auth_upload_vehicle_documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "anon_delete_vehicle_documents" ON storage.objects;
CREATE POLICY "auth_delete_vehicle_documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-documents');

-- ============================================================
-- Step 7: Ensure view uses security_invoker
-- ============================================================
ALTER VIEW public.vehicle_financial_summary SET (security_invoker = true);
