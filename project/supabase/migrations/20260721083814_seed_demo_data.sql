/*
# Seed demo data for Used Two-Wheeler Dealer Management Platform

## Overview
Populates the system with a realistic end-to-end scenario based on the spec's
sample scenario (Section 18) plus additional vehicles to demonstrate inventory
ageing, scores, alerts, and reports.

## Data
- 2 partners (50/50 default profit share)
- 4 parties (sellers + buyers)
- 5 vehicles (Honda Activa 6G, Bajaj Pulsar 150, Royal Enfield Classic 350, TVS Jupiter, Yamaha FZ-S)
- Purchases, payments, expenses, investments, profit-share allocations
- 1 inspection with full scoring items
- Documents (RC, insurance, PUC) with varied verification status
- 1 completed sale (Honda Activa 6G) with profit distribution
- 1 listing + enquiries
- Alerts for ageing vehicles

## Security
- No schema changes; data only.
*/

-- ============================================================
-- PARTNERS
-- ============================================================
INSERT INTO partners (id, name, mobile, email, default_profit_share_pct, joining_date, status, notes)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Arjun Mehta', '9876543210', 'arjun@wheelsjv.com', 50.00, '2025-04-01', 'active', 'Primary partner. Co-owner of the joint venture.'),
  ('22222222-2222-2222-2222-222222222222', 'Karthik Rajan', '9876501234', 'karthik@wheelsjv.com', 50.00, '2025-04-01', 'active', 'Secondary partner. Co-owner of the joint venture.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PARTIES (sellers + buyers)
-- ============================================================
INSERT INTO parties (id, party_type, full_name, mobile, city, state, identity_type, identity_number_masked, consent, notes)
VALUES
  ('a1a1a1a1-0001-0000-0000-000000000001', 'seller', 'Ramesh Kumar', '9988776655', 'Chennai', 'Tamil Nadu', 'Aadhaar', 'XXXX-XXXX-4321', true, 'Regular seller from Chennai.'),
  ('a1a1a1a1-0002-0000-0000-000000000002', 'seller', 'Priya Lakshmi', '9988123456', 'Coimbatore', 'Tamil Nadu', 'Aadhaar', 'XXXX-XXXX-7788', true, 'Selling due to upgrade.'),
  ('a1a1a1a1-0003-0000-0000-000000000003', 'seller', 'Mohammed Iqbal', '9845678901', 'Madurai', 'Tamil Nadu', 'Aadhaar', 'XXXX-XXXX-1122', true, 'Broker-referred.'),
  ('a1a1a1a1-0004-0000-0000-000000000004', 'seller', 'Sundar Venkat', '9123456780', 'Chennai', 'Tamil Nadu', 'PAN', 'XXXXX0000X', true, 'Office-goer selling scooter.'),
  ('a1a1a1a1-0005-0000-0000-000000000005', 'seller', 'Deepa Suresh', '9001122334', 'Chennai', 'Tamil Nadu', 'Aadhaar', 'XXXX-XXXX-5566', true, 'Relocating abroad.'),
  ('a1a1a1a1-0101-0000-0000-000000000101', 'buyer', 'Vignesh Arumugam', '9445566778', 'Chennai', 'Tamil Nadu', 'Aadhaar', 'XXXX-XXXX-8899', true, 'First-time buyer. Looking for Activa.'),
  ('a1a1a1a1-0102-0000-0000-000000000102', 'buyer', 'Lakshmi Narayanan', '9334455667', 'Chennai', 'Tamil Nadu', 'Aadhaar', 'XXXX-XXXX-2233', true, 'Office commuter.'),
  ('a1a1a1a1-0103-0000-0000-000000000103', 'buyer', 'Faizal Ahmed', '9223344556', 'Chennai', 'Tamil Nadu', 'Aadhaar', 'XXXX-XXXX-6677', true, 'Enquired about Pulsar.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VEHICLES
-- Vehicle 1: Honda Activa 6G (SOLD) — full purchase-to-sale scenario
-- Vehicle 2: Bajaj Pulsar 150 (in stock, 38 days) — Attention
-- Vehicle 3: Royal Enfield Classic 350 (in stock, 72 days) — Breach
-- Vehicle 4: TVS Jupiter (in stock, 22 days) — Normal
-- Vehicle 5: Yamaha FZ-S (under repair, 48 days) — High priority
-- ============================================================
INSERT INTO vehicles (id, stock_number, registration_number, category, manufacturer, brand, model, variant, fuel_type, colour, manufacture_year, registration_date, chassis_number, engine_number, odometer, owner_count, registration_city, registration_state, current_location, current_status, asking_price, minimum_price, onboarded_at, sold_at, notes)
VALUES
  ('b1b1b1b1-0001-0000-0000-000000000001', 'BIKE-2026-000001', 'TN 22 AB 1234', 'Scooter', 'Honda', 'Honda', 'Activa 6G', 'Std', 'Petrol', 'Black', 2022, '2022-03-15', 'MBLJEA60GNDJ01234', 'JEA60NDJ01234', 18500, 1, 'Chennai', 'Tamil Nadu', 'Central Yard', 'SOLD', 79000, 70000, '2026-07-10 10:00:00+00', '2026-08-05 14:30:00+00', 'Sample scenario vehicle. Fully documented.'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'BIKE-2026-000002', 'TN 07 CD 5678', 'Motorcycle', 'Bajaj', 'Bajaj', 'Pulsar 150', 'Single Disc', 'Petrol', 'Red', 2021, '2021-06-20', 'MBLJEA60GNDJ02222', 'JEA60NDJ02222', 24000, 2, 'Chennai', 'Tamil Nadu', 'Central Yard', 'READY_FOR_SALE', 72000, 62000, '2026-07-03 09:00:00+00', NULL, 'Good condition. Minor scratches.'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'BIKE-2026-000003', 'TN 45 EF 9012', 'Motorcycle', 'Royal Enfield', 'Royal Enfield', 'Classic 350', 'Halcyon', 'Petrol', 'Gunmetal Grey', 2020, '2020-11-10', 'MBLJEA60GNDJ03333', 'JEA60NDJ03333', 31000, 2, 'Coimbatore', 'Tamil Nadu', 'Central Yard', 'READY_FOR_SALE', 135000, 118000, '2026-05-20 11:00:00+00', NULL, 'Slow-moving. High-value. Needs attention.'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 'BIKE-2026-000004', 'TN 22 GH 3456', 'Scooter', 'TVS', 'TVS', 'Jupiter', 'ZX', 'Petrol', 'White', 2023, '2023-02-08', 'MBLJEA60GNDJ04444', 'JEA60NDJ04444', 9800, 1, 'Chennai', 'Tamil Nadu', 'Annex Yard', 'READY_FOR_SALE', 68000, 58000, '2026-07-19 12:00:00+00', NULL, 'Recent onboarding. Very low km.'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'BIKE-2026-000005', 'TN 09 IJ 7890', 'Motorcycle', 'Yamaha', 'Yamaha', 'FZ-S V3', 'FI', 'Petrol', 'Blue', 2021, '2021-09-25', 'MBLJEA60GNDJ05555', 'JEA60NDJ05555', 27000, 1, 'Chennai', 'Tamil Nadu', 'Service Bay', 'UNDER_REPAIR', 82000, 72000, '2026-06-23 15:00:00+00', NULL, 'Clutch plate replacement in progress.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VEHICLE STATUS HISTORY
-- ============================================================
INSERT INTO vehicle_status_history (vehicle_id, previous_status, new_status, changed_at, reason) VALUES
  ('b1b1b1b1-0001-0000-0000-000000000001', 'DRAFT', 'PURCHASED', '2026-07-10 10:30:00+00', 'Purchase recorded'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'PURCHASED', 'IN_YARD', '2026-07-10 18:00:00+00', 'Vehicle received at yard'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'IN_YARD', 'UNDER_INSPECTION', '2026-07-12 09:00:00+00', 'Inspection scheduled'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'UNDER_INSPECTION', 'READY_FOR_SALE', '2026-07-15 11:00:00+00', 'Inspection complete and approved'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'READY_FOR_SALE', 'RESERVED', '2026-08-01 16:00:00+00', 'Token advance received from buyer'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'RESERVED', 'SOLD', '2026-08-05 14:30:00+00', 'Sale completed and delivered'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'DRAFT', 'PURCHASED', '2026-07-03 09:30:00+00', 'Purchase recorded'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'PURCHASED', 'READY_FOR_SALE', '2026-07-08 10:00:00+00', 'Ready for sale'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'DRAFT', 'PURCHASED', '2026-05-20 11:30:00+00', 'Purchase recorded'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'PURCHASED', 'READY_FOR_SALE', '2026-05-25 10:00:00+00', 'Ready for sale'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 'DRAFT', 'PURCHASED', '2026-07-19 12:30:00+00', 'Purchase recorded'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 'PURCHASED', 'READY_FOR_SALE', '2026-07-20 09:00:00+00', 'Ready for sale'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'DRAFT', 'PURCHASED', '2026-06-23 15:30:00+00', 'Purchase recorded'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'PURCHASED', 'UNDER_REPAIR', '2026-07-15 10:00:00+00', 'Clutch issue identified during inspection');

-- ============================================================
-- PURCHASES + PAYMENTS
-- ============================================================
INSERT INTO purchases (id, vehicle_id, seller_party_id, purchase_date, agreed_price, broker_commission, other_fee, payment_status, handover_location, odometer_at_purchase, keys_received, documents_received, notes)
VALUES
  ('c1c1c1c1-0001-0000-0000-000000000001', 'b1b1b1b1-0001-0000-0000-000000000001', 'a1a1a1a1-0001-0000-0000-000000000001', '2026-07-10 10:00:00+00', 62000, 0, 0, 'Paid', 'Chennai', 18500, true, true, 'Direct purchase from owner.'),
  ('c1c1c1c1-0002-0000-0000-000000000002', 'b1b1b1b1-0002-0000-0000-000000000002', 'a1a1a1a1-0002-0000-0000-000000000002', '2026-07-03 09:00:00+00', 55000, 1000, 0, 'Paid', 'Coimbatore', 24000, true, true, 'Broker-referred purchase.'),
  ('c1c1c1c1-0003-0000-0000-000000000003', 'b1b1b1b1-0003-0000-0000-000000000003', 'a1a1a1a1-0003-0000-0000-000000000003', '2026-05-20 11:00:00+00', 115000, 2000, 500, 'Paid', 'Madurai', 31000, true, true, 'High-value purchase. Needs better marketing.'),
  ('c1c1c1c1-0004-0000-0000-000000000004', 'b1b1b1b1-0004-0000-0000-000000000004', 'a1a1a1a1-0004-0000-0000-000000000004', '2026-07-19 12:00:00+00', 54000, 0, 0, 'Paid', 'Chennai', 9800, true, true, 'Low-km scooter. Excellent buy.'),
  ('c1c1c1c1-0005-0000-0000-000000000005', 'b1b1b1b1-0005-0000-0000-000000000005', 'a1a1a1a1-0005-0000-0000-000000000005', '2026-06-23 15:00:00+00', 70000, 0, 0, 'Partially paid', 'Chennai', 27000, true, false, 'Balance pending. Repair in progress.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO purchase_payments (purchase_id, amount, payment_method, reference, paid_at) VALUES
  ('c1c1c1c1-0001-0000-0000-000000000001', 62000, 'UPI', 'UPI/ACT62000', '2026-07-10 10:15:00+00'),
  ('c1c1c1c1-0002-0000-0000-000000000002', 56000, 'Bank transfer', 'NEFT/PSR56000', '2026-07-03 09:20:00+00'),
  ('c1c1c1c1-0003-0000-0000-000000000003', 117500, 'Bank transfer', 'NEFT/RE350', '2026-05-20 11:30:00+00'),
  ('c1c1c1c1-0004-0000-0000-000000000004', 54000, 'Cash', 'CASH/54000', '2026-07-19 12:20:00+00'),
  ('c1c1c1c1-0005-0000-0000-000000000005', 40000, 'UPI', 'UPI/FZS40000', '2026-06-23 15:30:00+00');

-- ============================================================
-- INVESTMENTS
-- ============================================================
INSERT INTO investments (partner_id, vehicle_id, amount, investment_date, purpose, payment_method, reference, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'b1b1b1b1-0001-0000-0000-000000000001', 62800, '2026-07-10 08:00:00+00', 'Purchase + transportation', 'Bank transfer', 'NEFT/INV62800', 'Fully used'),
  ('11111111-1111-1111-1111-111111111111', 'b1b1b1b1-0002-0000-0000-000000000002', 56000, '2026-07-03 08:00:00+00', 'Purchase', 'Bank transfer', 'NEFT/INV56000', 'Partially used'),
  ('22222222-2222-2222-2222-222222222222', 'b1b1b1b1-0003-0000-0000-000000000003', 117500, '2026-05-20 08:00:00+00', 'Purchase', 'Bank transfer', 'NEFT/INV117500', 'Partially used'),
  ('11111111-1111-1111-1111-111111111111', 'b1b1b1b1-0004-0000-0000-000000000004', 54000, '2026-07-19 08:00:00+00', 'Purchase', 'UPI', 'UPI/INV54000', 'Partially used'),
  ('11111111-1111-1111-1111-111111111111', 'b1b1b1b1-0005-0000-0000-000000000005', 40000, '2026-06-23 08:00:00+00', 'Purchase advance', 'UPI', 'UPI/INV40000', 'Partially used');

-- ============================================================
-- EXPENSES (Vehicle 1 — full scenario per spec Section 18)
-- ============================================================
INSERT INTO expenses (vehicle_id, category, amount, expense_date, paid_by_partner_id, vendor, bill_available, description, approval_status, approved_by, approved_at) VALUES
  ('b1b1b1b1-0001-0000-0000-000000000001', 'Spare parts', 3500, '2026-07-13 10:00:00+00', '22222222-2222-2222-2222-222222222222', 'Sai Spares', true, 'Brake pads + air filter', 'Approved', 'Arjun Mehta', '2026-07-13 14:00:00+00'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'Mechanic labour', 1500, '2026-07-13 11:00:00+00', '22222222-2222-2222-2222-222222222222', 'Local mechanic', false, 'Fitting labour charges', 'Approved', 'Arjun Mehta', '2026-07-13 14:00:00+00'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'Transportation', 800, '2026-07-10 13:00:00+00', '11111111-1111-1111-1111-111111111111', NULL, false, 'Local pickup from seller home', 'Approved', 'Arjun Mehta', '2026-07-10 18:00:00+00'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'Yard rent', 1200, '2026-07-31 00:00:00+00', NULL, 'Yard Owner', true, 'Monthly yard allocation', 'Approved', 'Arjun Mehta', '2026-08-01 09:00:00+00'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'Cleaning and detailing', 500, '2026-07-14 15:00:00+00', NULL, 'Detailing shop', true, 'Full wash + wax + polish', 'Approved', 'Arjun Mehta', '2026-07-14 18:00:00+00'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'Spare parts', 1800, '2026-07-05 10:00:00+00', '22222222-2222-2222-2222-222222222222', 'Sai Spares', true, 'Chain set replacement', 'Approved', 'Arjun Mehta', '2026-07-05 14:00:00+00'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'Cleaning and detailing', 400, '2026-07-06 11:00:00+00', NULL, 'Detailing shop', true, 'Wash and polish', 'Approved', 'Arjun Mehta', '2026-07-06 14:00:00+00'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'Transportation', 1200, '2026-07-03 13:00:00+00', '22222222-2222-2222-2222-222222222222', 'Transport Co', true, 'Coimbatore to Chennai', 'Approved', 'Arjun Mehta', '2026-07-03 18:00:00+00'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'Service', 3500, '2026-05-24 10:00:00+00', '22222222-2222-2222-2222-222222222222', 'RE Service Centre', true, 'Full service + oil change', 'Approved', 'Karthik Rajan', '2026-05-24 16:00:00+00'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'Yard rent', 2400, '2026-06-30 00:00:00+00', NULL, 'Yard Owner', true, 'Two months yard allocation', 'Approved', 'Arjun Mehta', '2026-07-01 09:00:00+00'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'Advertisement', 800, '2026-06-15 12:00:00+00', NULL, 'OLX', true, 'Premium listing', 'Approved', 'Karthik Rajan', '2026-06-15 16:00:00+00'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 'Cleaning and detailing', 300, '2026-07-19 15:00:00+00', NULL, 'Detailing shop', true, 'Quick wash', 'Approved', 'Arjun Mehta', '2026-07-19 18:00:00+00'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'Spare parts', 2200, '2026-07-16 10:00:00+00', '22222222-2222-2222-2222-222222222222', 'Sai Spares', true, 'Clutch plate + cable', 'Approved', 'Arjun Mehta', '2026-07-16 14:00:00+00'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'Mechanic labour', 1200, '2026-07-16 11:00:00+00', '22222222-2222-2222-2222-222222222222', 'Local mechanic', false, 'Clutch fitting', 'Submitted', NULL, NULL),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'PUC', 100, '2026-07-20 09:00:00+00', NULL, 'PUC Centre', true, 'PUC renewal', 'Approved', 'Arjun Mehta', '2026-07-20 10:00:00+00');

-- ============================================================
-- PROFIT SHARE ALLOCATIONS (50/50 default for all vehicles)
-- ============================================================
INSERT INTO vehicle_profit_share_allocations (vehicle_id, partner_id, percentage) VALUES
  ('b1b1b1b1-0001-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 50.00),
  ('b1b1b1b1-0001-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 50.00),
  ('b1b1b1b1-0002-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 50.00),
  ('b1b1b1b1-0002-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 50.00),
  ('b1b1b1b1-0003-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 50.00),
  ('b1b1b1b1-0003-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 50.00),
  ('b1b1b1b1-0004-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 50.00),
  ('b1b1b1b1-0004-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 50.00),
  ('b1b1b1b1-0005-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 50.00),
  ('b1b1b1b1-0005-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 50.00)
ON CONFLICT (vehicle_id, partner_id) DO NOTHING;

-- ============================================================
-- INSPECTIONS + ITEMS
-- ============================================================
INSERT INTO inspections (id, vehicle_id, inspection_type, inspection_date, inspector_name, overall_manual_score, accident_status, accident_evidence, summary, status)
VALUES
  ('d1d1d1d1-0001-0000-0000-000000000001', 'b1b1b1b1-0001-0000-0000-000000000001', 'Mechanical', '2026-07-12 09:00:00+00', 'Suresh Mechanic', 82, 'No known accident', NULL, 'Good condition scooter. Minor wear on tyres. Engine smooth.', 'completed'),
  ('d1d1d1d1-0002-0000-0000-000000000002', 'b1b1b1b1-0002-0000-0000-000000000002', 'Visual only', '2026-07-06 10:00:00+00', 'Suresh Mechanic', 75, 'Minor accident suspected', 'Minor repaint on left side panel. Repainted panel detected.', 'Minor cosmetic damage. Mechanical good.', 'completed'),
  ('d1d1d1d1-0003-0000-0000-000000000003', 'b1b1b1b1-0003-0000-0000-000000000003', 'Test ride', '2026-05-24 11:00:00+00', 'Suresh Mechanic', 78, 'No known accident', NULL, 'Strong engine. Needs paint touch-up.', 'completed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO inspection_items (inspection_id, category, score, condition_level, observation, recommended_action, estimated_cost, urgency, weight) VALUES
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Engine', 85, 'Good', 'Smooth idle. No abnormal noise.', 'None', 0, 'Low', 25),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Frame and chassis', 90, 'Excellent', 'No damage or welding marks.', 'None', 0, 'Low', 15),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Transmission and clutch', 80, 'Good', 'Smooth engagement.', 'None', 0, 'Low', 10),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Brakes', 78, 'Good', 'Brake pads recently replaced.', 'None', 0, 'Low', 10),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Tyres', 70, 'Fair', 'Rear tyre worn. ~40% life remaining.', 'Replace rear tyre before sale', 1800, 'Medium', 8),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Suspension', 82, 'Good', 'No leakage. Smooth ride.', 'None', 0, 'Low', 8),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Electrical and battery', 85, 'Good', 'Battery healthy. All lights working.', 'None', 0, 'Low', 7),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Body and paint', 75, 'Fair', 'Minor scratches on front panel.', 'Touch-up paint', 300, 'Low', 7),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Documents', 95, 'Excellent', 'RC, insurance, PUC all valid.', 'None', 0, 'Low', 5),
  ('d1d1d1d1-0001-0000-0000-000000000001', 'Ownership confidence', 90, 'Excellent', 'Single owner. Documents match.', 'None', 0, 'Low', 5);

-- ============================================================
-- DOCUMENTS
-- ============================================================
INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, issuer, verification_status, verified_by, verified_at, notes) VALUES
  ('b1b1b1b1-0001-0000-0000-000000000001', 'RC book', 'TN22AB1234', '2022-03-15', NULL, 'RTO Chennai', 'Verified', 'Arjun Mehta', '2026-07-12 10:00:00+00', 'Original RC in hand.'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'Insurance', 'INS-2026-001', '2026-03-15', '2027-03-14', 'HDFC ERGO', 'Verified', 'Arjun Mehta', '2026-07-12 10:00:00+00', 'Comprehensive policy.'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'PUC', 'PUC-2026-001', '2026-06-10', '2026-12-09', 'PUC Centre', 'Verified', 'Arjun Mehta', '2026-07-12 10:00:00+00', 'Valid.'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'Seller identity', 'AADHAAR-XXXX-4321', NULL, NULL, 'Government of India', 'Verified', 'Arjun Mehta', '2026-07-10 10:30:00+00', 'Seller identity verified.'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'RC book', 'TN07CD5678', '2021-06-20', NULL, 'RTO Coimbatore', 'Verified', 'Karthik Rajan', '2026-07-04 10:00:00+00', 'Original RC.'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'Insurance', 'INS-2026-002', '2025-08-20', '2026-08-19', 'Bajaj Allianz', 'Pending verification', NULL, NULL, 'Expiring soon.'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'PUC', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, 'PUC not yet done.'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'RC book', 'TN45EF9012', '2020-11-10', NULL, 'RTO Madurai', 'Verified', 'Arjun Mehta', '2026-05-21 10:00:00+00', 'Original RC.'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'Insurance', 'INS-2025-003', '2025-01-10', '2026-01-09', 'ICICI Lombard', 'Expired', NULL, NULL, 'Insurance expired. Renewal needed.'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'PUC', 'PUC-2026-003', '2026-02-15', '2026-08-14', 'PUC Centre', 'Verified', 'Arjun Mehta', '2026-05-21 10:00:00+00', 'Valid but expiring soon.'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 'RC book', 'TN22GH3456', '2023-02-08', NULL, 'RTO Chennai', 'Verified', 'Arjun Mehta', '2026-07-20 09:30:00+00', 'Original RC.'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 'Insurance', 'INS-2026-004', '2026-02-08', '2027-02-07', 'TATA AIG', 'Verified', 'Arjun Mehta', '2026-07-20 09:30:00+00', 'Valid long-term policy.'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 'PUC', 'PUC-2026-004', '2026-04-01', '2026-10-01', 'PUC Centre', 'Verified', 'Arjun Mehta', '2026-07-20 09:30:00+00', 'Valid.'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'RC book', 'TN09IJ7890', '2021-09-25', NULL, 'RTO Chennai', 'Uploaded', NULL, NULL, 'Awaiting verification.'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'Insurance', 'INS-2026-005', '2025-09-25', '2026-09-24', 'HDFC ERGO', 'Uploaded', NULL, NULL, 'Awaiting verification.'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'PUC', 'PUC-2026-005', '2026-07-20', '2027-01-20', 'PUC Centre', 'Verified', 'Arjun Mehta', '2026-07-20 10:00:00+00', 'Recently renewed.');

-- ============================================================
-- LISTING + ENQUIRIES
-- ============================================================
INSERT INTO listings (vehicle_id, asking_price, minimum_price, status, listed_at, description, public_slug) VALUES
  ('b1b1b1b1-0001-0000-0000-000000000001', 79000, 70000, 'Sold', '2026-07-15 12:00:00+00', 'Single-owner 2022 Honda Activa 6G. 18,500 km. Fully serviced, new brake pads, valid insurance and PUC. Excellent condition.', 'activa-6g-2022-tn22ab1234'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 72000, 62000, 'Active', '2026-07-08 10:00:00+00', '2021 Bajaj Pulsar 150 Single Disc. 24,000 km. Good condition, minor cosmetic touch-up. Recently serviced.', 'pulsar-150-2021-tn07cd5678'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 135000, 118000, 'Active', '2026-05-25 10:00:00+00', '2020 Royal Enfield Classic 350 Halcyon. Gunmetal Grey. 31,000 km. Serviced, strong engine. Insurance renewal needed.', 'classic-350-2020-tn45ef9012'),
  ('b1b1b1b1-0004-0000-0000-000000000004', 68000, 58000, 'Active', '2026-07-20 09:00:00+00', '2023 TVS Jupiter ZX. Just 9,800 km. Single owner. Like-new condition.', 'jupiter-2023-tn22gh3456'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 82000, 72000, 'Draft', '2026-07-15 10:00:00+00', '2021 Yamaha FZ-S V3 FI. Clutch plate being replaced. Will be ready soon.', 'fz-s-2021-tn09ij7890')
ON CONFLICT (public_slug) DO NOTHING;

INSERT INTO enquiries (listing_id, vehicle_id, buyer_party_id, enquiry_date, channel, offered_price, status, follow_up_date, assigned_to, notes) VALUES
  ((SELECT id FROM listings WHERE public_slug='activa-6g-2022-tn22ab1234'), 'b1b1b1b1-0001-0000-0000-000000000001', 'a1a1a1a1-0101-0000-0000-000000000101', '2026-07-28 11:00:00+00', 'Direct', 75000, 'Won', '2026-08-01', 'Arjun Mehta', 'Walk-in enquiry. Negotiated to 78000 net.'),
  ((SELECT id FROM listings WHERE public_slug='activa-6g-2022-tn22ab1234'), 'b1b1b1b1-0001-0000-0000-000000000001', 'a1a1a1a1-0102-0000-0000-000000000102', '2026-07-25 14:00:00+00', 'WhatsApp', 70000, 'Lost', NULL, 'Karthik Rajan', 'Low offer. Went elsewhere.'),
  ((SELECT id FROM listings WHERE public_slug='pulsar-150-2021-tn07cd5678'), 'b1b1b1b1-0002-0000-0000-000000000002', 'a1a1a1a1-0103-0000-0000-000000000103', '2026-07-20 16:00:00+00', 'OLX', 68000, 'Negotiating', '2026-08-10', 'Arjun Mehta', 'Interested. Test ride done.'),
  ((SELECT id FROM listings WHERE public_slug='classic-350-2020-tn45ef9012'), 'b1b1b1b1-0003-0000-0000-000000000003', 'a1a1a1a1-0103-0000-0000-000000000103', '2026-06-20 12:00:00+00', 'Facebook', 125000, 'Lost', NULL, 'Karthik Rajan', 'Price too high for buyer. Did not proceed.'),
  ((SELECT id FROM listings WHERE public_slug='classic-350-2020-tn45ef9012'), 'b1b1b1b1-0003-0000-0000-000000000003', 'a1a1a1a1-0102-0000-0000-000000000102', '2026-07-05 10:00:00+00', 'Direct', 130000, 'Contacted', '2026-08-12', 'Karthik Rajan', 'Considering. Waiting for insurance renewal.');

-- ============================================================
-- SALE (Vehicle 1 — completed)
-- ============================================================
INSERT INTO sales (id, vehicle_id, buyer_party_id, sale_date, sale_price, discount, buyer_charges, payment_status, delivery_status, delivered_at, delivery_location, odometer_at_sale, notes, status)
VALUES
  ('e1e1e1e1-0001-0000-0000-000000000001', 'b1b1b1b1-0001-0000-0000-000000000001', 'a1a1a1a1-0101-0000-0000-000000000101', '2026-08-05 14:30:00+00', 79000, 1000, 0, 'Paid', 'Delivered', '2026-08-05 16:00:00+00', 'Chennai', 18600, 'Buyer paid full amount. Delivery completed.', 'Completed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sale_payments (sale_id, amount, payment_method, reference, paid_at) VALUES
  ('e1e1e1e1-0001-0000-0000-000000000001', 5000, 'Cash', 'ADV/5000', '2026-08-01 16:00:00+00'),
  ('e1e1e1e1-0001-0000-0000-000000000001', 74000, 'UPI', 'UPI/ACT74000', '2026-08-05 14:00:00+00');

-- ============================================================
-- PROFIT DISTRIBUTIONS (Vehicle 1 sale)
-- Total cost = 62000 + 7500 = 69500; net revenue 78000; profit 8500
-- Partner 1 principal 62800, Partner 2 principal 5000, profit 4250 each
-- ============================================================
INSERT INTO profit_distributions (vehicle_id, sale_id, partner_id, principal_return, profit_share, loss_share, total_entitlement, amount_paid, balance_payable, status)
VALUES
  ('b1b1b1b1-0001-0000-0000-000000000001', 'e1e1e1e1-0001-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 62800, 4250, 0, 67050, 67050, 0, 'Paid'),
  ('b1b1b1b1-0001-0000-0000-000000000001', 'e1e1e1e1-0001-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 5000, 4250, 0, 9250, 9250, 0, 'Paid');

-- ============================================================
-- ALERTS
-- ============================================================
INSERT INTO alerts (vehicle_id, alert_type, severity, title, message, days_in_inventory, status, assigned_to) VALUES
  ('b1b1b1b1-0002-0000-0000-000000000002', 'Ageing', 'Warning', 'Inventory ageing: 38 days', 'BIKE-2026-000002 (Bajaj Pulsar 150) has been in inventory for 38 days. Review pricing or marketing.', 38, 'Open', 'Arjun Mehta'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'Ageing', 'Critical', 'Holding period breach: 72 days', 'BIKE-2026-000003 (Royal Enfield Classic 350) has exceeded the 60-day holding limit. Immediate action required.', 72, 'Open', 'Karthik Rajan'),
  ('b1b1b1b1-0003-0000-0000-000000000003', 'Document', 'High', 'Insurance expired', 'BIKE-2026-000003 insurance expired on 2026-01-09. Renew before sale.', NULL, 'Open', 'Arjun Mehta'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'Ageing', 'High', 'High priority ageing: 48 days', 'BIKE-2026-000005 (Yamaha FZ-S) approaching 60-day limit. Complete repairs urgently.', 48, 'Open', 'Karthik Rajan'),
  ('b1b1b1b1-0005-0000-0000-000000000005', 'Repair', 'Medium', 'Repair overdue', 'BIKE-2026-000005 clutch repair started on 2026-07-15. Mechanic labour expense pending approval.', NULL, 'Open', 'Karthik Rajan'),
  ('b1b1b1b1-0002-0000-0000-000000000002', 'Document', 'Medium', 'Insurance expiring soon', 'BIKE-2026-000002 insurance expires on 2026-08-19. Renew before expiry.', NULL, 'Open', 'Arjun Mehta');

-- ============================================================
-- AUDIT LOGS
-- ============================================================
INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, reason) VALUES
  ('vehicle', 'b1b1b1b1-0001-0000-0000-000000000001', 'created', 'Arjun Mehta', 'Vehicle onboarded'),
  ('vehicle', 'b1b1b1b1-0001-0000-0000-000000000001', 'status_changed', 'Arjun Mehta', 'Marked READY_FOR_SALE after inspection approval'),
  ('vehicle', 'b1b1b1b1-0001-0000-0000-000000000001', 'sold', 'Arjun Mehta', 'Sale completed and delivered'),
  ('expense', NULL, 'approved', 'Arjun Mehta', 'Approved spare parts expense for Activa'),
  ('profit_distribution', NULL, 'approved', 'Arjun Mehta', 'Approved profit distribution for Activa sale');
