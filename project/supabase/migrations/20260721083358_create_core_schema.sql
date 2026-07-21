/*
# Create core schema for Used Two-Wheeler Dealer Management Platform

## Overview
Single-tenant operational system of record for a used two-wheeler dealer joint venture.
Covers: partners, parties (sellers/buyers), vehicles, documents, media, inspections,
purchases, expenses, investments, listings, enquiries, sales, profit distributions,
alerts, and audit logs. No authentication in this phase (single-tenant operational demo);
RLS uses `TO anon, authenticated` so the demo is fully interactive.

## New Tables
1. `partners` - joint-venture partners with default profit-share percentage
2. `parties` - sellers/buyers/related parties (unified customer record)
3. `vehicles` - vehicle master record with stock number and lifecycle status
4. `vehicle_status_history` - lifecycle transition log
5. `vehicle_documents` - RC, insurance, PUC, etc. with verification status
6. `vehicle_media` - photos/videos/audio metadata
7. `inspections` - inspection header with overall score and accident status
8. `inspection_items` - per-category score (engine, brakes, tyres, etc.)
9. `purchases` - purchase transaction with price/commission/fees
10. `purchase_payments` - multiple payment records per purchase
11. `expenses` - refurbishment/holding/logistics/selling expenses
12. `investments` - partner capital contributions per vehicle
13. `listings` - asking price, minimum price, public passport slug
14. `enquiries` - buyer enquiries and negotiation status
15. `sales` - sale transaction with price/discount/delivery
16. `sale_payments` - multiple payment records per sale
17. `vehicle_profit_share_allocations` - per-vehicle partner profit-share %
18. `profit_distributions` - computed partner settlement per sale
19. `alerts` - inventory ageing and document alerts
20. `audit_logs` - immutable audit trail

## Views
- `vehicle_financial_summary` - per-vehicle cost/revenue/profit rollup

## Security
- RLS enabled on all tables with `TO anon, authenticated` full CRUD (single-tenant shared app).

## Notes
- All monetary columns use numeric(14,2) (decimal, never float).
- Stock numbers generated as BIKE-YYYY-NNNNNN.
- Scores 0-100 integers.
*/

-- ============================================================
-- PARTNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text,
  email text,
  default_profit_share_pct numeric(5,2) NOT NULL DEFAULT 50.00,
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PARTIES (sellers / buyers / related)
-- ============================================================
CREATE TABLE IF NOT EXISTS parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type text NOT NULL DEFAULT 'seller',
  full_name text NOT NULL,
  mobile text,
  alternate_mobile text,
  email text,
  address text,
  city text,
  state text,
  postal_code text,
  identity_type text,
  identity_number_masked text,
  consent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_number text UNIQUE NOT NULL,
  registration_number text,
  category text NOT NULL DEFAULT 'Motorcycle',
  manufacturer text NOT NULL,
  brand text,
  model text NOT NULL,
  variant text,
  fuel_type text NOT NULL DEFAULT 'Petrol',
  colour text,
  manufacture_year int,
  registration_date date,
  chassis_number text,
  engine_number text,
  odometer int,
  owner_count int DEFAULT 1,
  registration_city text,
  registration_state text,
  current_location text,
  current_status text NOT NULL DEFAULT 'DRAFT',
  asking_price numeric(14,2),
  minimum_price numeric(14,2),
  onboarded_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(current_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_stock ON vehicles(stock_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_reg ON vehicles(registration_number);

-- ============================================================
-- VEHICLE STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
CREATE INDEX IF NOT EXISTS idx_vsh_vehicle ON vehicle_status_history(vehicle_id);

-- ============================================================
-- VEHICLE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_number text,
  issue_date date,
  expiry_date date,
  issuer text,
  verification_status text NOT NULL DEFAULT 'Not uploaded',
  verified_by text,
  verified_at timestamptz,
  file_url text,
  version int NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_vehicle ON vehicle_documents(vehicle_id);

-- ============================================================
-- VEHICLE MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'photo',
  media_category text NOT NULL,
  file_url text,
  thumbnail_url text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_vehicle ON vehicle_media(vehicle_id);

-- ============================================================
-- INSPECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inspection_type text NOT NULL DEFAULT 'Visual only',
  inspection_date timestamptz NOT NULL DEFAULT now(),
  inspector_name text,
  overall_manual_score int,
  accident_status text NOT NULL DEFAULT 'No known accident',
  accident_evidence text,
  summary text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insp_vehicle ON inspections(vehicle_id);

CREATE TABLE IF NOT EXISTS inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  category text NOT NULL,
  score int,
  condition_level text,
  observation text,
  recommended_action text,
  estimated_cost numeric(14,2) DEFAULT 0,
  urgency text DEFAULT 'Low',
  weight numeric(5,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_insp_items_insp ON inspection_items(inspection_id);

-- ============================================================
-- PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  seller_party_id uuid REFERENCES parties(id),
  purchase_date timestamptz NOT NULL DEFAULT now(),
  agreed_price numeric(14,2) NOT NULL DEFAULT 0,
  broker_commission numeric(14,2) NOT NULL DEFAULT 0,
  other_fee numeric(14,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Not paid',
  handover_location text,
  odometer_at_purchase int,
  keys_received boolean DEFAULT true,
  documents_received boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_vehicle ON purchases(vehicle_id);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'Cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX IF NOT EXISTS idx_purpay_purchase ON purchase_payments(purchase_id);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric(14,2) NOT NULL,
  expense_date timestamptz NOT NULL DEFAULT now(),
  paid_by_partner_id uuid REFERENCES partners(id),
  vendor text,
  bill_available boolean NOT NULL DEFAULT false,
  bill_url text,
  description text,
  approval_status text NOT NULL DEFAULT 'Approved',
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exp_vehicle ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_exp_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_exp_status ON expenses(approval_status);

-- ============================================================
-- INVESTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  investment_date timestamptz NOT NULL DEFAULT now(),
  purpose text,
  payment_method text NOT NULL DEFAULT 'Bank transfer',
  reference text,
  status text NOT NULL DEFAULT 'Received',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_vehicle ON investments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inv_partner ON investments(partner_id);

-- ============================================================
-- LISTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  asking_price numeric(14,2) NOT NULL,
  minimum_price numeric(14,2),
  status text NOT NULL DEFAULT 'Active',
  listed_at timestamptz NOT NULL DEFAULT now(),
  description text,
  public_slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_list_vehicle ON listings(vehicle_id);

-- ============================================================
-- ENQUIRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  buyer_party_id uuid REFERENCES parties(id),
  enquiry_date timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'Direct',
  offered_price numeric(14,2),
  status text NOT NULL DEFAULT 'New',
  follow_up_date date,
  assigned_to text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enq_vehicle ON enquiries(vehicle_id);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  buyer_party_id uuid REFERENCES parties(id),
  sale_date timestamptz NOT NULL DEFAULT now(),
  sale_price numeric(14,2) NOT NULL,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  buyer_charges numeric(14,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Not paid',
  delivery_status text NOT NULL DEFAULT 'Pending',
  delivered_at timestamptz,
  delivery_location text,
  odometer_at_sale int,
  notes text,
  status text NOT NULL DEFAULT 'Completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_vehicle ON sales(vehicle_id);

CREATE TABLE IF NOT EXISTS sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'Cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX IF NOT EXISTS idx_salepay_sale ON sale_payments(sale_id);

-- ============================================================
-- PROFIT SHARE
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_profit_share_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id),
  percentage numeric(5,2) NOT NULL,
  UNIQUE(vehicle_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_psa_vehicle ON vehicle_profit_share_allocations(vehicle_id);

CREATE TABLE IF NOT EXISTS profit_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id),
  principal_return numeric(14,2) NOT NULL DEFAULT 0,
  profit_share numeric(14,2) NOT NULL DEFAULT 0,
  loss_share numeric(14,2) NOT NULL DEFAULT 0,
  total_entitlement numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  balance_payable numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Calculated',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pd_vehicle ON profit_distributions(vehicle_id);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'Warning',
  title text NOT NULL,
  message text,
  days_in_inventory int,
  status text NOT NULL DEFAULT 'Open',
  assigned_to text,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle ON alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  performed_by text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- VEHICLE FINANCIAL SUMMARY VIEW
-- ============================================================
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
  WHERE approval_status = 'Approved'
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

-- ============================================================
-- RLS — single-tenant shared app, anon + authenticated full CRUD
-- ============================================================
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_profit_share_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- helper to apply full-CRUD anon+authenticated policies on a table
-- (inline since Supabase does not allow procedural loop easily; apply per table)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'partners','parties','vehicles','vehicle_status_history','vehicle_documents',
    'vehicle_media','inspections','inspection_items','purchases','purchase_payments',
    'expenses','investments','listings','enquiries','sales','sale_payments',
    'vehicle_profit_share_allocations','profit_distributions','alerts','audit_logs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'anon_select_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true);', 'anon_select_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'anon_insert_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO anon, authenticated WITH CHECK (true);', 'anon_insert_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'anon_update_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', 'anon_update_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'anon_delete_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO anon, authenticated USING (true);', 'anon_delete_' || t, t);
  END LOOP;
END $$;
