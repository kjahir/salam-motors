/*
# RLS cutover: per-owner isolation -> org + role based access

## Overview
The cutover. Drops the 4 `*_own_*` policies (added in
20260721144753_add_auth_user_ownership_rls.sql, `auth.uid() = user_id`)
on all 23 business tables and replaces them with org-membership + role
checked policies, using `is_org_member(org_id, roles[])` from
20260727090000. By the time this runs, every row already has the correct
`org_id` (20260727093000) and the existing sole account already has an
`owner` membership (20260727090000) - so the very first query this
account makes under the new policies succeeds immediately, no lockout
window.

Two policy shapes are used:
- SELECT with `roles = null` -> any active member of the org, any role,
  can read (e.g. vehicles - everyone needs to see inventory).
- SELECT with an explicit roles array -> only those roles can read at all
  (e.g. purchases/expenses - cost data hidden from Sales/Mechanic
  entirely, not just hidden from editing).

Role matrix (see project plan for full rationale):
  vehicles/vehicle_status_history/vehicle_media/listings/enquiries/sales
    -> read: everyone; write: owner, manager, sales_executive
  inspections/inspection_items/mechanic_inspection_feedback/vehicle_documents
    -> read: everyone; write: owner, manager, mechanic_inspector
  sale_payments (customer payment receipt, revenue side)
    -> read: everyone; write: owner, manager, sales_executive, accountant
  purchases/purchase_payments/expenses (cost data)
    -> read+write: owner, manager, accountant only (sales/mechanic: no access)
  investments/profit_distributions/profit_settlement_payments (settlements)
    -> read: owner, manager, accountant; write: owner, accountant only
      (manager is read-only here - approves reports, doesn't run settlements)
  vehicle_profit_share_allocations (per-vehicle setup, tied to onboarding)
    -> read: owner, manager, accountant; write: owner, manager, accountant
  partners (admin CRUD)
    -> read: owner, manager, accountant; write: owner only
  parties/alerts
    -> read: everyone; write: everyone (acknowledging alerts, logging a
      contact is a normal part of every staff role's day-to-day)
  compliance_policies
    -> read: everyone (violations surface app-wide); write: owner, manager
  audit_logs
    -> read: owner, manager only; insert: everyone (their own actions);
      no update/delete policy at all - audit trail becomes append-only
      as part of this cutover (previously any owner could edit/delete
      their own audit rows, an oversight in the original ownership
      migration's blanket 4-policy loop)

Partners (JV investors, not staff) get an additional read-only OR-branch
on investments/profit_distributions/profit_settlement_payments via
`is_partner_self()`, restricted to their own partner_id - see the bottom
of this file.
*/

-- ============================================================
-- Step 1: drop the old owner-scoped policies on all 23 tables
-- ============================================================
do $$
declare
  t text;
  tables text[] := array[
    'vehicles', 'partners', 'parties', 'purchases', 'purchase_payments',
    'sales', 'sale_payments', 'expenses', 'investments', 'inspections',
    'inspection_items', 'vehicle_documents', 'vehicle_media', 'listings',
    'enquiries', 'alerts', 'audit_logs', 'vehicle_status_history',
    'vehicle_profit_share_allocations', 'profit_distributions',
    'mechanic_inspection_feedback', 'profit_settlement_payments',
    'compliance_policies'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "select_own_%s" on public.%I', t, t);
    execute format('drop policy if exists "insert_own_%s" on public.%I', t, t);
    execute format('drop policy if exists "update_own_%s" on public.%I', t, t);
    execute format('drop policy if exists "delete_own_%s" on public.%I', t, t);
  end loop;
end $$;

-- ============================================================
-- Step 2: vehicles / vehicle_status_history / vehicle_media /
--         listings / enquiries / sales
--         read: everyone in the org, write: owner/manager/sales_executive
-- ============================================================
do $$
declare
  t text;
  tables text[] := array['vehicles', 'vehicle_status_history', 'listings', 'enquiries', 'sales'];
begin
  foreach t in array tables loop
    execute format('create policy "org_select_%s" on public.%I for select to authenticated using (is_org_member(org_id))', t, t);
    execute format('create policy "org_insert_%s" on public.%I for insert to authenticated with check (is_org_member(org_id, array[''owner'',''manager'',''sales_executive'']))', t, t);
    execute format('create policy "org_update_%s" on public.%I for update to authenticated using (is_org_member(org_id, array[''owner'',''manager'',''sales_executive''])) with check (is_org_member(org_id, array[''owner'',''manager'',''sales_executive'']))', t, t);
    execute format('create policy "org_delete_%s" on public.%I for delete to authenticated using (is_org_member(org_id, array[''owner'',''manager'']))', t, t);
  end loop;
end $$;

-- vehicle_media: same read/delete shape, but mechanics can also upload during inspection
create policy "org_select_vehicle_media" on public.vehicle_media for select to authenticated
  using (is_org_member(org_id));
create policy "org_insert_vehicle_media" on public.vehicle_media for insert to authenticated
  with check (is_org_member(org_id, array['owner','manager','sales_executive','mechanic_inspector']));
create policy "org_update_vehicle_media" on public.vehicle_media for update to authenticated
  using (is_org_member(org_id, array['owner','manager','sales_executive','mechanic_inspector']))
  with check (is_org_member(org_id, array['owner','manager','sales_executive','mechanic_inspector']));
create policy "org_delete_vehicle_media" on public.vehicle_media for delete to authenticated
  using (is_org_member(org_id, array['owner','manager']));

-- ============================================================
-- Step 3: inspections / inspection_items / mechanic_inspection_feedback
--         / vehicle_documents
--         read: everyone, write: owner/manager/mechanic_inspector
-- ============================================================
do $$
declare
  t text;
  tables text[] := array['inspections', 'inspection_items', 'mechanic_inspection_feedback', 'vehicle_documents'];
begin
  foreach t in array tables loop
    execute format('create policy "org_select_%s" on public.%I for select to authenticated using (is_org_member(org_id))', t, t);
    execute format('create policy "org_insert_%s" on public.%I for insert to authenticated with check (is_org_member(org_id, array[''owner'',''manager'',''mechanic_inspector'']))', t, t);
    execute format('create policy "org_update_%s" on public.%I for update to authenticated using (is_org_member(org_id, array[''owner'',''manager'',''mechanic_inspector''])) with check (is_org_member(org_id, array[''owner'',''manager'',''mechanic_inspector'']))', t, t);
    execute format('create policy "org_delete_%s" on public.%I for delete to authenticated using (is_org_member(org_id, array[''owner'',''manager'']))', t, t);
  end loop;
end $$;

-- ============================================================
-- Step 4: sale_payments (revenue side) - accountant can also record/reconcile
-- ============================================================
create policy "org_select_sale_payments" on public.sale_payments for select to authenticated
  using (is_org_member(org_id));
create policy "org_insert_sale_payments" on public.sale_payments for insert to authenticated
  with check (is_org_member(org_id, array['owner','manager','sales_executive','accountant']));
create policy "org_update_sale_payments" on public.sale_payments for update to authenticated
  using (is_org_member(org_id, array['owner','manager','sales_executive','accountant']))
  with check (is_org_member(org_id, array['owner','manager','sales_executive','accountant']));
create policy "org_delete_sale_payments" on public.sale_payments for delete to authenticated
  using (is_org_member(org_id, array['owner','manager','accountant']));

-- ============================================================
-- Step 5: purchases / purchase_payments / expenses - cost data,
--         no access at all for sales_executive / mechanic_inspector
-- ============================================================
do $$
declare
  t text;
  tables text[] := array['purchases', 'purchase_payments', 'expenses'];
begin
  foreach t in array tables loop
    execute format('create policy "org_select_%s" on public.%I for select to authenticated using (is_org_member(org_id, array[''owner'',''manager'',''accountant'']))', t, t);
    execute format('create policy "org_insert_%s" on public.%I for insert to authenticated with check (is_org_member(org_id, array[''owner'',''manager'',''accountant'']))', t, t);
    execute format('create policy "org_update_%s" on public.%I for update to authenticated using (is_org_member(org_id, array[''owner'',''manager'',''accountant''])) with check (is_org_member(org_id, array[''owner'',''manager'',''accountant'']))', t, t);
    execute format('create policy "org_delete_%s" on public.%I for delete to authenticated using (is_org_member(org_id, array[''owner'',''manager'']))', t, t);
  end loop;
end $$;

-- ============================================================
-- Step 6: investments / profit_distributions / profit_settlement_payments
--         settlements - manager is read-only, only owner/accountant write
-- ============================================================
do $$
declare
  t text;
  tables text[] := array['investments', 'profit_distributions', 'profit_settlement_payments'];
begin
  foreach t in array tables loop
    execute format('create policy "org_select_%s" on public.%I for select to authenticated using (is_org_member(org_id, array[''owner'',''manager'',''accountant'']))', t, t);
    execute format('create policy "org_insert_%s" on public.%I for insert to authenticated with check (is_org_member(org_id, array[''owner'',''accountant'']))', t, t);
    execute format('create policy "org_update_%s" on public.%I for update to authenticated using (is_org_member(org_id, array[''owner'',''accountant''])) with check (is_org_member(org_id, array[''owner'',''accountant'']))', t, t);
    execute format('create policy "org_delete_%s" on public.%I for delete to authenticated using (is_org_member(org_id, array[''owner'',''accountant'']))', t, t);
  end loop;
end $$;

-- ============================================================
-- Step 7: vehicle_profit_share_allocations - vehicle-onboarding setup,
--         not the settlement flow itself
-- ============================================================
create policy "org_select_vehicle_profit_share_allocations" on public.vehicle_profit_share_allocations for select to authenticated
  using (is_org_member(org_id, array['owner','manager','accountant']));
create policy "org_insert_vehicle_profit_share_allocations" on public.vehicle_profit_share_allocations for insert to authenticated
  with check (is_org_member(org_id, array['owner','manager','accountant']));
create policy "org_update_vehicle_profit_share_allocations" on public.vehicle_profit_share_allocations for update to authenticated
  using (is_org_member(org_id, array['owner','manager','accountant']))
  with check (is_org_member(org_id, array['owner','manager','accountant']));
create policy "org_delete_vehicle_profit_share_allocations" on public.vehicle_profit_share_allocations for delete to authenticated
  using (is_org_member(org_id, array['owner','manager']));

-- ============================================================
-- Step 8: partners (admin CRUD) - owner only writes, manager/accountant read
-- ============================================================
create policy "org_select_partners" on public.partners for select to authenticated
  using (is_org_member(org_id, array['owner','manager','accountant']) or auth_user_id = auth.uid());
create policy "org_insert_partners" on public.partners for insert to authenticated
  with check (is_org_member(org_id, array['owner']));
create policy "org_update_partners" on public.partners for update to authenticated
  using (is_org_member(org_id, array['owner']))
  with check (is_org_member(org_id, array['owner']));
create policy "org_delete_partners" on public.partners for delete to authenticated
  using (is_org_member(org_id, array['owner']));

-- ============================================================
-- Step 9: parties / alerts - everyone reads and writes (day-to-day use)
-- ============================================================
do $$
declare
  t text;
  tables text[] := array['parties', 'alerts'];
begin
  foreach t in array tables loop
    execute format('create policy "org_select_%s" on public.%I for select to authenticated using (is_org_member(org_id))', t, t);
    execute format('create policy "org_insert_%s" on public.%I for insert to authenticated with check (is_org_member(org_id))', t, t);
    execute format('create policy "org_update_%s" on public.%I for update to authenticated using (is_org_member(org_id)) with check (is_org_member(org_id))', t, t);
    execute format('create policy "org_delete_%s" on public.%I for delete to authenticated using (is_org_member(org_id, array[''owner'',''manager'']))', t, t);
  end loop;
end $$;

-- ============================================================
-- Step 10: compliance_policies - everyone reads, owner/manager edit
-- ============================================================
create policy "org_select_compliance_policies" on public.compliance_policies for select to authenticated
  using (is_org_member(org_id));
create policy "org_insert_compliance_policies" on public.compliance_policies for insert to authenticated
  with check (is_org_member(org_id, array['owner','manager']));
create policy "org_update_compliance_policies" on public.compliance_policies for update to authenticated
  using (is_org_member(org_id, array['owner','manager']))
  with check (is_org_member(org_id, array['owner','manager']));
create policy "org_delete_compliance_policies" on public.compliance_policies for delete to authenticated
  using (is_org_member(org_id, array['owner','manager']));

-- ============================================================
-- Step 11: audit_logs - owner/manager read all, everyone inserts their
--          own actions, no update/delete policy (append-only from here on)
-- ============================================================
create policy "org_select_audit_logs" on public.audit_logs for select to authenticated
  using (is_org_member(org_id, array['owner','manager']));
create policy "org_insert_audit_logs" on public.audit_logs for insert to authenticated
  with check (is_org_member(org_id) and user_id = auth.uid());

-- ============================================================
-- Step 12: partner self-service read access (JV investors, not staff)
--          layered on top of the staff policies above via OR
-- ============================================================
create policy "partner_self_select_investments" on public.investments for select to authenticated
  using (is_partner_self(partner_id));
create policy "partner_self_select_profit_distributions" on public.profit_distributions for select to authenticated
  using (is_partner_self(partner_id));
create policy "partner_self_select_profit_settlement_payments" on public.profit_settlement_payments for select to authenticated
  using (is_partner_self((select p.partner_id from public.profit_distributions p where p.id = profit_settlement_payments.distribution_id)));
