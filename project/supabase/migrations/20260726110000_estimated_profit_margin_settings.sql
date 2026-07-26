/*
# Estimated profit margin settings

## Overview
"Estimated Profit" previously depended on `vehicles.asking_price` /
`minimum_price`, which are optional fields many vehicles never get filled
in — leaving the estimate blank for a lot of inventory, and the Dashboard's
aggregate KPI silently treated those blanks as ₹0 profit rather than
excluding them, understating the total without any indication.

Per discussion, this replaces that with a cost-based range: estimated
profit = total vehicle cost (purchase + approved expenses) × a configurable
margin range (default 10%–30%), the range a dealer actually gave as a
rule of thumb. Total cost is always available (accrues from purchase price
onward), so this is never blank and never silently wrong.

## Design
A single-row "settings" table rather than per-vehicle or per-user config —
this margin range is a business-wide policy, not owned by whichever staff
account happens to be logged in. The `id boolean primary key default true
check (id)` trick guarantees exactly one row can ever exist.

Deliberately NOT using the owner-scoped `auth.uid() = user_id` RLS pattern
used elsewhere in this app (20260721144753_add_auth_user_ownership_rls.sql)
— that pattern is what caused the very issue that started this session's
work (a shared resource becoming invisible to everyone except its creator).
Any authenticated staff member can read and update this one row.
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  estimated_profit_margin_low_pct numeric NOT NULL DEFAULT 10,
  estimated_profit_margin_high_pct numeric NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_app_settings" ON app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "update_app_settings" ON app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
