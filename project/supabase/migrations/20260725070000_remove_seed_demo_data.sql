/*
# Remove seed demo data

## Overview
The app and database have moved to production (2026-07-25). The demo
scenario inserted by `20260721083814_seed_demo_data.sql` (5 sample vehicles
and everything hung off them, per the spec's Section 18 walkthrough) is no
longer appropriate to have mixed into real inventory and should be removed.

## Approach
- The 5 seed vehicles are deleted by their fixed IDs. Every dependent table
  (status history, documents, media, inspections/items, purchases/payments,
  expenses, investments, listings/enquiries, sales/payments/profit
  distributions, profit-share allocations, alerts) has `vehicle_id ...
  REFERENCES vehicles(id) ON DELETE CASCADE`, so this alone cleans up the
  entire scenario. These IDs (`b1b1b1b1-000N-...`) are fixed, seed-only
  values that cannot collide with a real `gen_random_uuid()`-generated
  vehicle, so this is unconditionally safe.
- `audit_logs` has no FK (entity_id is polymorphic), so its 3 seed rows
  tied to these vehicle IDs are deleted explicitly. Two further seed
  audit_log rows (an expense approval and a profit-distribution approval)
  have `entity_id IS NULL` with no reliable key to match by — left alone
  deliberately; they're inert historical text with no functional impact.
- The seed `partners` (Arjun Mehta, Karthik Rajan) and `parties` (sellers/
  buyers) rows are only deleted `WHERE NOT EXISTS` any remaining reference
  to them. If the business has been using these same partner/party records
  for real transactions since go-live, those references now belong to real
  (non-seed) rows and this condition correctly leaves them in place instead
  of deleting or erroring.
*/

-- ============================================================
-- SEED VEHICLES (cascades purchases, sales, expenses, investments,
-- inspections, documents, listings, enquiries, alerts, etc.)
-- ============================================================
DELETE FROM vehicles WHERE id IN (
  'b1b1b1b1-0001-0000-0000-000000000001',
  'b1b1b1b1-0002-0000-0000-000000000002',
  'b1b1b1b1-0003-0000-0000-000000000003',
  'b1b1b1b1-0004-0000-0000-000000000004',
  'b1b1b1b1-0005-0000-0000-000000000005'
);

-- ============================================================
-- AUDIT LOGS tied to the seed vehicles above (no FK to cascade from)
-- ============================================================
DELETE FROM audit_logs
WHERE entity_type = 'vehicle'
  AND entity_id IN (
    'b1b1b1b1-0001-0000-0000-000000000001',
    'b1b1b1b1-0002-0000-0000-000000000002',
    'b1b1b1b1-0003-0000-0000-000000000003',
    'b1b1b1b1-0004-0000-0000-000000000004',
    'b1b1b1b1-0005-0000-0000-000000000005'
  );

-- ============================================================
-- SEED PARTIES (sellers + buyers) — only if nothing still references them
-- ============================================================
DELETE FROM parties p
WHERE p.id IN (
  'a1a1a1a1-0001-0000-0000-000000000001',
  'a1a1a1a1-0002-0000-0000-000000000002',
  'a1a1a1a1-0003-0000-0000-000000000003',
  'a1a1a1a1-0004-0000-0000-000000000004',
  'a1a1a1a1-0005-0000-0000-000000000005',
  'a1a1a1a1-0101-0000-0000-000000000101',
  'a1a1a1a1-0102-0000-0000-000000000102',
  'a1a1a1a1-0103-0000-0000-000000000103'
)
AND NOT EXISTS (SELECT 1 FROM purchases WHERE purchases.seller_party_id = p.id)
AND NOT EXISTS (SELECT 1 FROM sales WHERE sales.buyer_party_id = p.id)
AND NOT EXISTS (SELECT 1 FROM enquiries WHERE enquiries.buyer_party_id = p.id);

-- ============================================================
-- SEED PARTNERS (Arjun Mehta, Karthik Rajan) — only if nothing still
-- references them
-- ============================================================
DELETE FROM partners pt
WHERE pt.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
)
AND NOT EXISTS (SELECT 1 FROM investments WHERE investments.partner_id = pt.id)
AND NOT EXISTS (SELECT 1 FROM expenses WHERE expenses.paid_by_partner_id = pt.id)
AND NOT EXISTS (SELECT 1 FROM vehicle_profit_share_allocations WHERE vehicle_profit_share_allocations.partner_id = pt.id)
AND NOT EXISTS (SELECT 1 FROM profit_distributions WHERE profit_distributions.partner_id = pt.id);
