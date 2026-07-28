-- Automated role-based RLS regression suite.
--
-- Promotes the manual, eyeball-it checklist in supabase/verify_role_matrix.sql
-- into a self-checking script: every check is a `do $$ ... if not (...) then
-- raise exception ... end if; end $$;` block, so a regression fails loudly
-- (the whole script aborts with a non-zero exit / visible ERROR) instead of
-- requiring a human to compare row counts by eye.
--
-- Covers:
--   - The org/role permission matrix from
--     20260727110000_role_based_rls_cutover.sql (business tables).
--   - Explicit cross-org isolation (two orgs, a user who only belongs to
--     org A, asserting zero visibility into org B's vehicles/purchases/sales).
--   - The five new admin_org_select_assistant_* policies added in
--     20260728130100_assistant_org_audit_rls.sql (owner/manager see every
--     org member's Ask Salam activity; other roles still only see their own).
--   - The app_settings columns added in
--     20260728140500_org_preferences_and_social_handles.sql (read: any org
--     member, write: owner/manager only - same org_select_app_settings /
--     org_update_app_settings policies from 20260727100000, just asserting
--     they still cover the new columns).
--   - accept_own_invite() from 20260728140000_accept_own_invite.sql (a user
--     can flip their own 'invited' membership to 'active', and only their own).
--
-- SAFETY: this script is READ-ONLY against real data. All fixtures (two
-- throwaway organizations, throwaway auth.users/memberships/partners, and a
-- handful of throwaway business rows) are created *inside* the transaction
-- below and never committed. Run it wrapped exactly like this, against a
-- disposable local/staging target only - never point this at production:
--
--   BEGIN;
--   \i supabase/tests/role_matrix_test.sql
--   ROLLBACK;
--
-- (The BEGIN/ROLLBACK are also included below so `psql -f` on a throwaway
-- database works standalone; nesting a redundant outer BEGIN/ROLLBACK
-- around this file, as in the \i example above, is harmless.)
--
-- This file is intentionally never executed by CI or by this agent - it is
-- reviewed for correctness against the actual policy definitions in the
-- referenced migrations, not run against any live or staging database as
-- part of this change.

BEGIN;

-- ============================================================
-- Section 0: helpers (all in pg_temp, so they vanish on ROLLBACK)
-- ============================================================

-- Small key/value scratch table so fixture ids created in one `do $$` block
-- (which cannot see another block's local variables) can be looked up by
-- every later assertion block.
CREATE TABLE pg_temp.rls_ctx (key text PRIMARY KEY, val uuid);

CREATE OR REPLACE FUNCTION pg_temp.ctx_set(p_key text, p_val uuid)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO pg_temp.rls_ctx (key, val) VALUES (p_key, p_val)
  ON CONFLICT (key) DO UPDATE SET val = excluded.val;
$$;

CREATE OR REPLACE FUNCTION pg_temp.ctx(p_key text)
RETURNS uuid LANGUAGE sql AS $$
  SELECT val FROM pg_temp.rls_ctx WHERE key = p_key;
$$;

-- Impersonate a given auth user (same trick as the manual checklist this
-- file replaces: set the `role` GUC to `authenticated`, so `to authenticated`
-- policies apply, and stuff `request.jwt.claims` so `auth.uid()` resolves),
-- run one statement, and report back row count / error text instead of
-- raising - so callers can assert on either outcome (expect success with N
-- rows, or expect a permission failure) without a control-flow exception
-- escaping the assertion block itself.
--
-- p_sql is wrapped as a data-modifying CTE (`with s as (%s) select count(*)
-- ... from s`), not a plain FROM-subquery - Postgres does not allow INSERT/
-- UPDATE/DELETE directly inside a FROM subquery, only inside a WITH. This
-- form works uniformly for both plain SELECTs and `insert/update ...
-- returning ...` statements (every DML statement passed to this helper
-- below includes RETURNING for exactly this reason).
CREATE OR REPLACE FUNCTION pg_temp.run_as(p_user_id uuid, p_sql text)
RETURNS TABLE (row_count bigint, err text) LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    RETURN QUERY EXECUTE format('with rls_test_stmt as (%s) select count(*) as row_count, null::text as err from rls_test_stmt', p_sql);
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 0::bigint, sqlerrm;
  END;
  PERFORM set_config('role', 'postgres', true);
END;
$$;

-- ============================================================
-- Section 1: fixtures - two orgs, one full role set in org A, a
-- cross-org owner in org B, a partner, and minimal business rows.
-- ============================================================

DO $$
DECLARE
  v_org_a uuid;
  v_org_b uuid;
  v_owner_a uuid;
  v_manager_a uuid;
  v_sales_a uuid;
  v_accountant_a uuid;
  v_mechanic_a uuid;
  v_owner_b uuid;
  v_partner_user uuid;
  v_partner_a uuid;
  v_partner_other uuid;
  v_invited_user uuid;
BEGIN
  INSERT INTO organizations (name, slug, status)
    VALUES ('RLS Test Org A', 'rls-test-org-a-' || substr(gen_random_uuid()::text, 1, 8), 'active')
    RETURNING id INTO v_org_a;
  INSERT INTO organizations (name, slug, status)
    VALUES ('RLS Test Org B', 'rls-test-org-b-' || substr(gen_random_uuid()::text, 1, 8), 'active')
    RETURNING id INTO v_org_b;
  PERFORM pg_temp.ctx_set('org_a', v_org_a);
  PERFORM pg_temp.ctx_set('org_b', v_org_b);

  -- One throwaway auth user per role in org A, plus a lone owner in org B
  -- used only for the cross-org isolation checks. auth.users rows created
  -- this way have no real credentials and never leave this transaction.
  INSERT INTO auth.users (id, email) VALUES
    (gen_random_uuid(), 'rls-owner-a@example.invalid'),
    (gen_random_uuid(), 'rls-manager-a@example.invalid'),
    (gen_random_uuid(), 'rls-sales-a@example.invalid'),
    (gen_random_uuid(), 'rls-accountant-a@example.invalid'),
    (gen_random_uuid(), 'rls-mechanic-a@example.invalid'),
    (gen_random_uuid(), 'rls-owner-b@example.invalid'),
    (gen_random_uuid(), 'rls-partner-user@example.invalid'),
    (gen_random_uuid(), 'rls-invited-a@example.invalid')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_owner_a FROM auth.users WHERE email = 'rls-owner-a@example.invalid';
  SELECT id INTO v_manager_a FROM auth.users WHERE email = 'rls-manager-a@example.invalid';
  SELECT id INTO v_sales_a FROM auth.users WHERE email = 'rls-sales-a@example.invalid';
  SELECT id INTO v_accountant_a FROM auth.users WHERE email = 'rls-accountant-a@example.invalid';
  SELECT id INTO v_mechanic_a FROM auth.users WHERE email = 'rls-mechanic-a@example.invalid';
  SELECT id INTO v_owner_b FROM auth.users WHERE email = 'rls-owner-b@example.invalid';
  SELECT id INTO v_partner_user FROM auth.users WHERE email = 'rls-partner-user@example.invalid';
  SELECT id INTO v_invited_user FROM auth.users WHERE email = 'rls-invited-a@example.invalid';

  PERFORM pg_temp.ctx_set('owner_a', v_owner_a);
  PERFORM pg_temp.ctx_set('manager_a', v_manager_a);
  PERFORM pg_temp.ctx_set('sales_a', v_sales_a);
  PERFORM pg_temp.ctx_set('accountant_a', v_accountant_a);
  PERFORM pg_temp.ctx_set('mechanic_a', v_mechanic_a);
  PERFORM pg_temp.ctx_set('owner_b', v_owner_b);
  PERFORM pg_temp.ctx_set('partner_user', v_partner_user);
  PERFORM pg_temp.ctx_set('invited_a', v_invited_user);

  INSERT INTO memberships (org_id, user_id, role, status, email, joined_at) VALUES
    (v_org_a, v_owner_a, 'owner', 'active', 'rls-owner-a@example.invalid', now()),
    (v_org_a, v_manager_a, 'manager', 'active', 'rls-manager-a@example.invalid', now()),
    (v_org_a, v_sales_a, 'sales_executive', 'active', 'rls-sales-a@example.invalid', now()),
    (v_org_a, v_accountant_a, 'accountant', 'active', 'rls-accountant-a@example.invalid', now()),
    (v_org_a, v_mechanic_a, 'mechanic_inspector', 'active', 'rls-mechanic-a@example.invalid', now()),
    (v_org_b, v_owner_b, 'owner', 'active', 'rls-owner-b@example.invalid', now())
  ON CONFLICT (org_id, user_id) DO NOTHING;

  -- An invited-but-not-yet-active membership for the accept_own_invite() check.
  INSERT INTO memberships (org_id, user_id, role, status, email)
    VALUES (v_org_a, v_invited_user, 'sales_executive', 'invited', 'rls-invited-a@example.invalid')
    ON CONFLICT (org_id, user_id) DO NOTHING;

  -- Two partners: one linked to a login (for is_partner_self checks), one not.
  INSERT INTO partners (org_id, name, status, auth_user_id)
    VALUES (v_org_a, 'RLS Test Partner (linked)', 'active', v_partner_user)
    RETURNING id INTO v_partner_a;
  INSERT INTO partners (org_id, name, status)
    VALUES (v_org_a, 'RLS Test Partner (other)', 'active')
    RETURNING id INTO v_partner_other;
  PERFORM pg_temp.ctx_set('partner_a', v_partner_a);
  PERFORM pg_temp.ctx_set('partner_other', v_partner_other);
END $$;

DO $$
DECLARE
  v_vehicle_a uuid;
  v_vehicle_b uuid;
  v_purchase_a uuid;
BEGIN
  -- One vehicle/purchase/sale in each org, for the org-scoped read checks
  -- and the cross-org isolation checks.
  INSERT INTO vehicles (org_id, stock_number, manufacturer, model, current_status)
    VALUES (pg_temp.ctx('org_a'), 'RLSTEST-A-' || substr(gen_random_uuid()::text, 1, 8), 'Honda', 'Activa', 'DRAFT')
    RETURNING id INTO v_vehicle_a;
  INSERT INTO vehicles (org_id, stock_number, manufacturer, model, current_status)
    VALUES (pg_temp.ctx('org_b'), 'RLSTEST-B-' || substr(gen_random_uuid()::text, 1, 8), 'TVS', 'Jupiter', 'DRAFT')
    RETURNING id INTO v_vehicle_b;
  PERFORM pg_temp.ctx_set('vehicle_a', v_vehicle_a);
  PERFORM pg_temp.ctx_set('vehicle_b', v_vehicle_b);

  INSERT INTO purchases (org_id, vehicle_id, agreed_price, broker_commission, other_fee)
    VALUES (pg_temp.ctx('org_a'), v_vehicle_a, 50000, 500, 0)
    RETURNING id INTO v_purchase_a;
  PERFORM pg_temp.ctx_set('purchase_a', v_purchase_a);
  INSERT INTO purchases (org_id, vehicle_id, agreed_price)
    VALUES (pg_temp.ctx('org_b'), v_vehicle_b, 40000);

  INSERT INTO purchase_payments (org_id, purchase_id, amount, proof_urls)
    VALUES (pg_temp.ctx('org_a'), v_purchase_a, 50500, ARRAY['org-a/proof1.jpg']);

  INSERT INTO expenses (org_id, vehicle_id, category, amount, approval_status)
    VALUES (pg_temp.ctx('org_a'), v_vehicle_a, 'Spare parts', 1200, 'Approved');

  INSERT INTO investments (org_id, partner_id, vehicle_id, amount, status)
    VALUES (pg_temp.ctx('org_a'), pg_temp.ctx('partner_a'), v_vehicle_a, 20000, 'Received');
  -- A second investment, tied to the *other* (unlinked) partner, so the
  -- partner-self check below can assert the linked partner does NOT see it.
  INSERT INTO investments (org_id, partner_id, vehicle_id, amount, status)
    VALUES (pg_temp.ctx('org_a'), pg_temp.ctx('partner_other'), v_vehicle_a, 15000, 'Received');

  INSERT INTO sales (org_id, vehicle_id, sale_price)
    VALUES (pg_temp.ctx('org_a'), v_vehicle_a, 60000);
  INSERT INTO sales (org_id, vehicle_id, sale_price)
    VALUES (pg_temp.ctx('org_b'), v_vehicle_b, 48000);
END $$;

DO $$
DECLARE
  v_settings_exists boolean;
BEGIN
  -- app_settings singleton for org A, exercising the new columns added in
  -- 20260728140500_org_preferences_and_social_handles.sql.
  SELECT EXISTS (SELECT 1 FROM app_settings WHERE org_id = pg_temp.ctx('org_a')) INTO v_settings_exists;
  IF NOT v_settings_exists THEN
    INSERT INTO app_settings (
      org_id, estimated_profit_margin_low_pct, estimated_profit_margin_high_pct,
      preferred_language, instagram_handle, website_url
    ) VALUES (
      pg_temp.ctx('org_a'), 10, 30, 'en', 'salam_motors_test', 'https://example.invalid'
    );
  END IF;
END $$;

DO $$
DECLARE
  v_conversation_id uuid;
  v_run_id uuid;
  v_message_id uuid;
BEGIN
  -- One Ask Salam conversation/message/run/tool-call/proposal set, created
  -- (as far as the fixture is concerned) by sales_a in org A, for the
  -- admin_org_select_assistant_* checks in Section 4.
  INSERT INTO assistant_conversations (org_id, created_by_user_id, title, locale)
    VALUES (pg_temp.ctx('org_a'), pg_temp.ctx('sales_a'), 'RLS test conversation', 'en')
    RETURNING id INTO v_conversation_id;
  PERFORM pg_temp.ctx_set('conversation_a', v_conversation_id);

  INSERT INTO assistant_messages (org_id, conversation_id, role, content, created_by_user_id)
    VALUES (pg_temp.ctx('org_a'), v_conversation_id, 'user', '{"text": "hello"}'::jsonb, pg_temp.ctx('sales_a'))
    RETURNING id INTO v_message_id;

  INSERT INTO assistant_runs (org_id, conversation_id, requested_by_user_id, input_message_id, status, model)
    VALUES (pg_temp.ctx('org_a'), v_conversation_id, pg_temp.ctx('sales_a'), v_message_id, 'completed', 'test-model')
    RETURNING id INTO v_run_id;
  PERFORM pg_temp.ctx_set('run_a', v_run_id);

  INSERT INTO assistant_tool_calls (org_id, conversation_id, run_id, requested_by_user_id, tool_name, status)
    VALUES (pg_temp.ctx('org_a'), v_conversation_id, v_run_id, pg_temp.ctx('sales_a'), 'list_alerts', 'completed');

  INSERT INTO assistant_action_proposals (
    org_id, conversation_id, run_id, requested_by_user_id, action_type,
    argument_hash, confirmation_token_hash, risk_level, idempotency_key, expires_at
  ) VALUES (
    pg_temp.ctx('org_a'), v_conversation_id, v_run_id, pg_temp.ctx('sales_a'), 'alert.acknowledge',
    'rls-test-argument-hash', 'rls-test-confirmation-hash', 'low', 'rls-test-idempotency-key', now() + interval '1 day'
  );
END $$;

-- ============================================================
-- Section 2: role matrix from 20260727110000_role_based_rls_cutover.sql
-- ============================================================

-- vehicles: everyone in the org reads.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err
    FROM pg_temp.run_as(pg_temp.ctx('mechanic_a'), format('select id from vehicles where id = %L', pg_temp.ctx('vehicle_a')));
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: mechanic_inspector should be able to read vehicles, got error: %', v_err;
  END IF;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: mechanic_inspector should see the org''s own vehicle (expected 1, got %)', v_row_count;
  END IF;
END $$;

-- purchases/purchase_payments/expenses: hidden entirely from sales_executive and mechanic_inspector.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('sales_a'), 'select id from purchases');
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: sales_executive should see 0 purchases (cost data), got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('mechanic_a'), 'select id from purchases');
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: mechanic_inspector should see 0 purchases (cost data), got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('sales_a'), 'select id from expenses');
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: sales_executive should see 0 expenses (cost data), got %', v_row_count;
  END IF;
END $$;

-- purchases/purchase_payments/expenses: visible to owner/manager/accountant.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err
    FROM pg_temp.run_as(pg_temp.ctx('accountant_a'), format('select id from purchases where id = %L', pg_temp.ctx('purchase_a')));
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: accountant should be able to read purchases, got error: %', v_err;
  END IF;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: accountant should see the org''s own purchase (expected 1, got %)', v_row_count;
  END IF;
END $$;

-- investments: read = owner/manager/accountant; write = owner/accountant only (manager is read-only).
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('accountant_a'), 'select id from investments');
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: accountant should be able to read investments, got error: %', v_err;
  END IF;
  IF v_row_count < 1 THEN
    RAISE EXCEPTION 'FAILED: accountant should see at least 1 investment, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('insert into investments (org_id, partner_id, amount) values (%L, %L, 1) returning id', pg_temp.ctx('org_a'), pg_temp.ctx('partner_a')));
  IF v_err IS NULL THEN
    RAISE EXCEPTION 'FAILED: manager should NOT be able to insert investments (read-only on settlements), but it succeeded';
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_a'),
    format('insert into investments (org_id, partner_id, amount) values (%L, %L, 1) returning id', pg_temp.ctx('org_a'), pg_temp.ctx('partner_a')));
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: owner should be able to insert investments, got error: %', v_err;
  END IF;
END $$;

-- sales_executive can create a vehicle (write allowed: owner/manager/sales_executive).
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('sales_a'),
    format('insert into vehicles (org_id, stock_number, manufacturer, model, current_status) values (%L, %L, %L, %L, %L) returning id',
      pg_temp.ctx('org_a'), 'RLSTEST-SALES-' || substr(gen_random_uuid()::text, 1, 8), 'Bajaj', 'Pulsar', 'DRAFT'));
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: sales_executive should be able to insert a vehicle, got error: %', v_err;
  END IF;
END $$;

-- mechanic_inspector cannot create a vehicle.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('mechanic_a'),
    format('insert into vehicles (org_id, stock_number, manufacturer, model, current_status) values (%L, %L, %L, %L, %L) returning id',
      pg_temp.ctx('org_a'), 'RLSTEST-MECH-' || substr(gen_random_uuid()::text, 1, 8), 'Bajaj', 'Pulsar', 'DRAFT'));
  IF v_err IS NULL THEN
    RAISE EXCEPTION 'FAILED: mechanic_inspector should NOT be able to insert a vehicle, but it succeeded';
  END IF;
END $$;

-- audit_logs: read = owner/manager only; mechanic_inspector sees 0 even for
-- their own org's rows (there won't be any real rows here, but the point is
-- no error and 0 visibility, not a permission-shaped error).
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('mechanic_a'), 'select id from audit_logs');
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: mechanic_inspector querying audit_logs should return 0 rows, not error: %', v_err;
  END IF;
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: mechanic_inspector should see 0 audit_logs, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'), 'select id from audit_logs');
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: manager should be able to query audit_logs, got error: %', v_err;
  END IF;
END $$;

-- partners: owner/manager/accountant read; only owner writes.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('sales_a'), 'select id from partners');
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: sales_executive should see 0 partners, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('insert into partners (org_id, name) values (%L, %L) returning id', pg_temp.ctx('org_a'), 'RLS test manager-inserted partner'));
  IF v_err IS NULL THEN
    RAISE EXCEPTION 'FAILED: manager should NOT be able to insert partners (owner-only), but it succeeded';
  END IF;
END $$;

-- ============================================================
-- Section 3: explicit cross-org isolation
-- ============================================================

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_a'),
    format('select id from vehicles where org_id = %L', pg_temp.ctx('org_b')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: org A owner should see 0 of org B''s vehicles, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_a'),
    format('select id from purchases where org_id = %L', pg_temp.ctx('org_b')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: org A owner should see 0 of org B''s purchases, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_a'),
    format('select id from sales where org_id = %L', pg_temp.ctx('org_b')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: org A owner should see 0 of org B''s sales, got %', v_row_count;
  END IF;
END $$;

-- Unfiltered selects also come back empty for org B's data specifically:
-- confirm org A's own vehicle is visible but org B's is not, in one query,
-- so this isn't just "0 rows because the org_id filter itself matched nothing".
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_a'),
    format('select id from vehicles where id in (%L, %L)', pg_temp.ctx('vehicle_a'), pg_temp.ctx('vehicle_b')));
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: org A owner should see exactly org A''s vehicle out of {vehicle_a, vehicle_b} (expected 1, got %)', v_row_count;
  END IF;
END $$;

-- org A's owner cannot even insert a row explicitly scoped to org B.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_a'),
    format('insert into vehicles (org_id, stock_number, manufacturer, model, current_status) values (%L, %L, %L, %L, %L) returning id',
      pg_temp.ctx('org_b'), 'RLSTEST-XORG-' || substr(gen_random_uuid()::text, 1, 8), 'Honda', 'Shine', 'DRAFT'));
  IF v_err IS NULL THEN
    RAISE EXCEPTION 'FAILED: org A owner should NOT be able to insert a vehicle scoped to org B, but it succeeded';
  END IF;
END $$;

-- org B's owner is symmetrically blind to org A.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_b'),
    format('select id from vehicles where id = %L', pg_temp.ctx('vehicle_a')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: org B owner should see 0 of org A''s vehicles, got %', v_row_count;
  END IF;
END $$;

-- partner-self read: the linked partner sees only their own investment, not
-- the other partner's, even within the same org/vehicle.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('partner_user'),
    format('select id from investments where partner_id = %L', pg_temp.ctx('partner_a')));
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: linked partner should see their own 1 investment, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('partner_user'),
    format('select id from investments where partner_id = %L', pg_temp.ctx('partner_other')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: linked partner should see 0 of the other partner''s investments, got %', v_row_count;
  END IF;
END $$;

-- ============================================================
-- Section 4: new assistant_* org-wide admin read policies
-- (20260728130100_assistant_org_audit_rls.sql)
-- ============================================================

-- The actor (sales_a) still sees their own conversation via the pre-existing
-- actor_select_* policy.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('sales_a'),
    format('select id from assistant_conversations where id = %L', pg_temp.ctx('conversation_a')));
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: sales_a (actor) should see their own assistant_conversations row, got %', v_row_count;
  END IF;
END $$;

-- manager_a, who is NOT the actor, sees it too via the new admin_org_select policy.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('select id from assistant_conversations where id = %L', pg_temp.ctx('conversation_a')));
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: manager_a should see sales_a''s assistant_conversations row via admin_org_select_assistant_conversations, got %', v_row_count;
  END IF;
END $$;

-- accountant_a - neither the actor nor owner/manager - sees nothing.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('accountant_a'),
    format('select id from assistant_conversations where id = %L', pg_temp.ctx('conversation_a')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: accountant_a should NOT see sales_a''s assistant_conversations row, got %', v_row_count;
  END IF;
END $$;

-- Same owner/manager-only admin visibility, mirrored across the other four
-- tables this migration touched.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('select id from assistant_messages where conversation_id = %L', pg_temp.ctx('conversation_a')));
  IF v_row_count < 1 THEN
    RAISE EXCEPTION 'FAILED: manager_a should see sales_a''s assistant_messages via admin_org_select_assistant_messages, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('accountant_a'),
    format('select id from assistant_messages where conversation_id = %L', pg_temp.ctx('conversation_a')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: accountant_a should NOT see sales_a''s assistant_messages, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('select id from assistant_runs where id = %L', pg_temp.ctx('run_a')));
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: manager_a should see sales_a''s assistant_runs row via admin_org_select_assistant_runs, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('accountant_a'),
    format('select id from assistant_runs where id = %L', pg_temp.ctx('run_a')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: accountant_a should NOT see sales_a''s assistant_runs row, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('select id from assistant_tool_calls where run_id = %L', pg_temp.ctx('run_a')));
  IF v_row_count < 1 THEN
    RAISE EXCEPTION 'FAILED: manager_a should see sales_a''s assistant_tool_calls via admin_org_select_assistant_tool_calls, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('accountant_a'),
    format('select id from assistant_tool_calls where run_id = %L', pg_temp.ctx('run_a')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: accountant_a should NOT see sales_a''s assistant_tool_calls, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('select id from assistant_action_proposals where run_id = %L', pg_temp.ctx('run_a')));
  IF v_row_count < 1 THEN
    RAISE EXCEPTION 'FAILED: manager_a should see sales_a''s assistant_action_proposals via admin_org_select_assistant_action_proposals, got %', v_row_count;
  END IF;
END $$;

DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('accountant_a'),
    format('select id from assistant_action_proposals where run_id = %L', pg_temp.ctx('run_a')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: accountant_a should NOT see sales_a''s assistant_action_proposals, got %', v_row_count;
  END IF;
END $$;

-- Cross-org: org B's owner (who is not a member of org A at all) sees none of
-- org A's assistant_* rows, admin policy or not.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('owner_b'),
    format('select id from assistant_conversations where id = %L', pg_temp.ctx('conversation_a')));
  IF v_row_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: org B owner should see 0 of org A''s assistant_conversations, got %', v_row_count;
  END IF;
END $$;

-- ============================================================
-- Section 5: app_settings new columns
-- (20260728140500_org_preferences_and_social_handles.sql)
-- ============================================================

-- Any active org member (including sales_executive, who has no special
-- finance/admin access) can read the new preference columns.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('sales_a'),
    format('select org_id from app_settings where org_id = %L and preferred_language = %L', pg_temp.ctx('org_a'), 'en'));
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: sales_executive should be able to read app_settings.preferred_language, got error: %', v_err;
  END IF;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: sales_executive should see the org''s app_settings row with preferred_language=en, got %', v_row_count;
  END IF;
END $$;

-- manager can update the new columns (org_update_app_settings allows owner/manager).
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('manager_a'),
    format('update app_settings set instagram_handle = %L where org_id = %L returning org_id', 'salam_updated', pg_temp.ctx('org_a')));
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: manager should be able to update app_settings.instagram_handle, got error: %', v_err;
  END IF;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: manager''s app_settings update should have affected 1 row, got %', v_row_count;
  END IF;
END $$;

-- sales_executive cannot update the new columns.
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('sales_a'),
    format('update app_settings set twitter_handle = %L where org_id = %L returning org_id', 'should_not_apply', pg_temp.ctx('org_a')));
  IF v_err IS NULL AND v_row_count > 0 THEN
    RAISE EXCEPTION 'FAILED: sales_executive should NOT be able to update app_settings, but it affected % row(s)', v_row_count;
  END IF;
END $$;

-- accountant cannot update the new columns either (only owner/manager can).
DO $$
DECLARE v_row_count bigint; v_err text;
BEGIN
  SELECT row_count, err INTO v_row_count, v_err FROM pg_temp.run_as(pg_temp.ctx('accountant_a'),
    format('update app_settings set website_url = %L where org_id = %L returning org_id', 'https://should-not-apply.invalid', pg_temp.ctx('org_a')));
  IF v_err IS NULL AND v_row_count > 0 THEN
    RAISE EXCEPTION 'FAILED: accountant should NOT be able to update app_settings, but it affected % row(s)', v_row_count;
  END IF;
END $$;

-- ============================================================
-- Section 6: accept_own_invite() (20260728140000_accept_own_invite.sql)
-- ============================================================

-- The invited user accepts their own invite: returns true, flips their own
-- membership row from 'invited' to 'active'.
DO $$
DECLARE
  v_accepted boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.ctx('invited_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT public.accept_own_invite() INTO v_accepted;
  PERFORM set_config('role', 'postgres', true);

  IF v_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'FAILED: accept_own_invite() should return true when an invited membership exists for the caller, got %', v_accepted;
  END IF;
END $$;

DO $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM memberships WHERE org_id = pg_temp.ctx('org_a') AND user_id = pg_temp.ctx('invited_a');
  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'FAILED: invited_a''s membership should now be status=active, got %', v_status;
  END IF;
END $$;

-- Calling it again with no remaining 'invited' rows for that user is a no-op
-- (returns false), not an error.
DO $$
DECLARE
  v_accepted boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.ctx('invited_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT public.accept_own_invite() INTO v_accepted;
  PERFORM set_config('role', 'postgres', true);

  IF v_accepted IS NOT FALSE THEN
    RAISE EXCEPTION 'FAILED: accept_own_invite() should return false when the caller has no invited membership left, got %', v_accepted;
  END IF;
END $$;

-- A caller cannot use accept_own_invite() to activate someone *else's*
-- invited membership - it is entirely scoped to auth.uid()'s own rows. Set
-- up a second invited row for a different user, then call as sales_a (who
-- has no invited row of their own) and confirm the other row is untouched.
DO $$
DECLARE
  v_other_invited uuid;
  v_accepted boolean;
  v_status_before text;
  v_status_after text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'rls-invited-b@example.invalid')
    ON CONFLICT DO NOTHING;
  SELECT id INTO v_other_invited FROM auth.users WHERE email = 'rls-invited-b@example.invalid';
  INSERT INTO memberships (org_id, user_id, role, status, email)
    VALUES (pg_temp.ctx('org_a'), v_other_invited, 'accountant', 'invited', 'rls-invited-b@example.invalid')
    ON CONFLICT (org_id, user_id) DO NOTHING;

  SELECT status INTO v_status_before FROM memberships WHERE org_id = pg_temp.ctx('org_a') AND user_id = v_other_invited;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.ctx('sales_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT public.accept_own_invite() INTO v_accepted;
  PERFORM set_config('role', 'postgres', true);

  SELECT status INTO v_status_after FROM memberships WHERE org_id = pg_temp.ctx('org_a') AND user_id = v_other_invited;

  IF v_status_before IS DISTINCT FROM 'invited' OR v_status_after IS DISTINCT FROM 'invited' THEN
    RAISE EXCEPTION 'FAILED: another user''s invited membership must not change when a different, uninvolved user calls accept_own_invite() (before=%, after=%)', v_status_before, v_status_after;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'role_matrix_test.sql: all assertions passed';
END $$;

ROLLBACK;
