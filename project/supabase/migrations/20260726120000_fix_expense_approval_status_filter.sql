/*
# Fix Approved-vs-Paid expense filter mismatch

## The bug
`computeCostBreakdown()` (src/lib/calc.ts) — which drives the Vehicle Detail
page's own Total Vehicle Cost, realized profit, and per-vehicle Estimated
Profit — counts an expense as confirmed cost when
`approval_status IN ('Approved', 'Paid')`.

This view counted only `approval_status = 'Approved'`, silently excluding
`Paid` expenses. `Finance.tsx` (Reports) independently recomputed the same
total with the same `'Approved'`-only mistake. Net effect: any vehicle with
a `Paid` (not `Approved`) expense showed a lower cost / higher profit on
Dashboard, Inventory, and Reports than on its own Vehicle Detail page.

`Paid` is, if anything, more certain than `Approved` — it should never have
been excluded. This migration brings the view in line with calc.ts's
existing (correct) behavior. The paired app-code change exports
`isApproved()` from calc.ts and has Finance.tsx import it instead of
duplicating the filter, so this can't drift apart again.

## Data handling
View definition only — no table data changes. Existing `Paid` expenses
already exist; this just stops the view from silently dropping them.
*/

CREATE OR REPLACE VIEW vehicle_financial_summary AS
SELECT
  v.id AS vehicle_id,
  v.stock_number,
  v.current_status,
  v.asking_price,
  v.minimum_price,
  -- purchase cost
  COALESCE(p.agreed_price, 0) + COALESCE(p.broker_commission, 0) + COALESCE(p.other_fee, 0) AS purchase_cost,
  -- expense breakdown
  COALESCE(e.refurb, 0) AS refurbishment_cost,
  COALESCE(e.holding, 0) AS holding_cost,
  COALESCE(e.logistics, 0) AS logistics_cost,
  COALESCE(e.docs_selling, 0) AS documentation_selling_cost,
  COALESCE(e.other, 0) AS other_cost,
  COALESCE(e.total, 0) AS total_expense,
  -- total vehicle cost
  (COALESCE(p.agreed_price, 0) + COALESCE(p.broker_commission, 0) + COALESCE(p.other_fee, 0) + COALESCE(e.total, 0)) AS total_vehicle_cost,
  -- sale
  COALESCE(s.sale_price, 0) AS sale_price,
  COALESCE(s.discount, 0) AS discount,
  COALESCE(s.buyer_charges, 0) AS buyer_charges,
  COALESCE(s.net_revenue, 0) AS net_sale_revenue,
  -- gross profit (sale revenue - total cost); null when no sale
  CASE WHEN s.sale_price IS NOT NULL
       THEN (COALESCE(s.net_revenue, 0) - (COALESCE(p.agreed_price, 0) + COALESCE(p.broker_commission, 0) + COALESCE(p.other_fee, 0) + COALESCE(e.total, 0)))
       ELSE NULL END AS gross_profit,
  -- estimated profit (asking price - total cost)
  CASE WHEN v.asking_price IS NOT NULL
       THEN (v.asking_price - (COALESCE(p.agreed_price, 0) + COALESCE(p.broker_commission, 0) + COALESCE(p.other_fee, 0) + COALESCE(e.total, 0)))
       ELSE NULL END AS estimated_profit,
  -- total invested
  COALESCE(inv.total_invested, 0) AS total_invested
FROM vehicles v
LEFT JOIN (
  SELECT vehicle_id,
    agreed_price, broker_commission, other_fee
  FROM purchases
) p ON p.vehicle_id = v.id
LEFT JOIN (
  SELECT vehicle_id,
    SUM(CASE WHEN category IN ('Spare parts','Mechanic labour','Service','Cleaning and detailing') THEN amount ELSE 0 END) AS refurb,
    SUM(CASE WHEN category IN ('Yard rent') THEN amount ELSE 0 END) AS holding,
    SUM(CASE WHEN category IN ('Transportation','Fuel','Test ride') THEN amount ELSE 0 END) AS logistics,
    SUM(CASE WHEN category IN ('Document transfer','Insurance','PUC','Advertisement','Broker commission') THEN amount ELSE 0 END) AS docs_selling,
    SUM(CASE WHEN category IN ('Penalty or fine','Other') THEN amount ELSE 0 END) AS other,
    SUM(amount) AS total
  FROM expenses
  WHERE approval_status IN ('Approved', 'Paid')
  GROUP BY vehicle_id
) e ON e.vehicle_id = v.id
LEFT JOIN (
  SELECT vehicle_id,
    sale_price, discount, buyer_charges,
    (sale_price + buyer_charges - discount) AS net_revenue
  FROM sales
  WHERE status = 'Completed'
) s ON s.vehicle_id = v.id
LEFT JOIN (
  SELECT vehicle_id, SUM(amount) AS total_invested
  FROM investments
  WHERE status IN ('Received','Partially used','Fully used')
  GROUP BY vehicle_id
) inv ON inv.vehicle_id = v.id;

ALTER VIEW vehicle_financial_summary SET (security_invoker = true);
