-- Manual role-based RLS verification checklist.
--
-- Run this against a staging clone (or the linked project, post-push, in a
-- disposable transaction you roll back) via the Supabase SQL editor or psql.
-- It creates one throwaway membership per role plus one partner-linked user,
-- then impersonates each via `set local role authenticated` +
-- `request.jwt.claims`, and checks the permission matrix from
-- 20260727110000_role_based_rls_cutover.sql actually holds.
--
-- Wrap the whole thing in a transaction and ROLLBACK at the end so nothing
-- here touches real data:
--
--   BEGIN;
--   \i verify_role_matrix.sql
--   ROLLBACK;

do $$
declare
  v_org_id uuid;
  v_owner_user uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  select user_id into v_owner_user from memberships where org_id = v_org_id and role = 'owner' limit 1;

  -- One fake auth user + membership per role, for local testing only.
  -- auth.users rows created this way have no real credentials and should
  -- never leave this transaction (hence the ROLLBACK).
  insert into auth.users (id, email) values
    (gen_random_uuid(), 'test-manager@example.invalid'),
    (gen_random_uuid(), 'test-sales@example.invalid'),
    (gen_random_uuid(), 'test-accountant@example.invalid'),
    (gen_random_uuid(), 'test-mechanic@example.invalid')
  on conflict do nothing;

  insert into memberships (org_id, user_id, role, status, email)
  select v_org_id, u.id, r.role, 'active', u.email
  from auth.users u
  join (values
    ('test-manager@example.invalid', 'manager'),
    ('test-sales@example.invalid', 'sales_executive'),
    ('test-accountant@example.invalid', 'accountant'),
    ('test-mechanic@example.invalid', 'mechanic_inspector')
  ) as r(email, role) on r.email = u.email
  on conflict (org_id, user_id) do nothing;
end $$;

-- Helper: run a query as a given user id, return only whether it errored /
-- how many rows it saw. Usage:
--   select * from run_as((select id from auth.users where email = 'test-sales@example.invalid'), 'select count(*) from expenses');
create or replace function pg_temp.run_as(p_user_id uuid, p_sql text)
returns table (row_count bigint, err text) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    return query execute format('select count(*) as row_count, null::text as err from (%s) s', p_sql);
  exception when others then
    return query select 0::bigint, sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
end;
$$;

-- Expected: 0 rows / permission-shaped result for Sales Exec and Mechanic
-- on cost-side tables; > 0 (or at least no error) for Owner/Manager/Accountant.
select 'sales_executive can see expenses (expect 0)' as check, *
from pg_temp.run_as((select user_id from memberships where email = 'test-sales@example.invalid'), 'select id from expenses');

select 'mechanic can see purchases (expect 0)' as check, *
from pg_temp.run_as((select user_id from memberships where email = 'test-mechanic@example.invalid'), 'select id from purchases');

select 'accountant can see investments (expect rows or empty, no error)' as check, *
from pg_temp.run_as((select user_id from memberships where email = 'test-accountant@example.invalid'), 'select id from investments');

select 'manager cannot insert investments (expect error)' as check, *
from pg_temp.run_as((select user_id from memberships where email = 'test-manager@example.invalid'),
  'insert into investments (partner_id, amount) select id, 1 from partners limit 1 returning id');

select 'sales_executive can insert a vehicle (expect no error)' as check, *
from pg_temp.run_as((select user_id from memberships where email = 'test-sales@example.invalid'),
  'select 1'); -- replace with an actual insert against a disposable vehicle row if you want to exercise the insert policy directly

select 'mechanic cannot see audit_logs (expect 0)' as check, *
from pg_temp.run_as((select user_id from memberships where email = 'test-mechanic@example.invalid'), 'select id from audit_logs');

select 'manager can see audit_logs (expect rows or empty, no error)' as check, *
from pg_temp.run_as((select user_id from memberships where email = 'test-manager@example.invalid'), 'select id from audit_logs');
