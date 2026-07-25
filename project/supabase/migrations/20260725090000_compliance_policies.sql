/*
# Compliance policies

## Overview
Introduces admin-editable rules for document and financial-evidence
compliance per vehicle (e.g. "RC book required", "every expense needs a
bill", "purchase payments must reconcile to the agreed price"). Policies
are data, not code, so they can be added/edited/disabled from the app
without a deploy — `category`/`rule_type`/`severity` stay plain `text`
with no CHECK constraint, the same convention already used for
`expenses.category`/`investments.status`/etc. (validated only by a TS
constants array + `<Select>`, not the database).

## rule_type / params shapes
- `document_required`: `{ document_type, accepted_statuses? }` — vehicle
  must have a `vehicle_documents` row of this type in an accepted
  status (defaults to `["Verified","Uploaded"]` if omitted).
- `evidence_required`: `{ entity: "purchase_payment" | "expense" | "investment" }`
  — every row of that entity for the vehicle must have ≥1 file attached.
- `amount_reconciliation`: `{ target: "purchase_payments_vs_purchase_price", tolerance }`
  — purchase payments must sum to `agreed_price + broker_commission + other_fee`
  within `tolerance`.

No seed `INSERT` here — `user_id DEFAULT auth.uid()` has no session at
migration time, and the app is past the demo-seed phase (see
`20260725070000_remove_seed_demo_data.sql`). Defaults are offered from
the app instead (a "Load recommended defaults" button on the Policies
page, inserting `DEFAULT_COMPLIANCE_POLICIES` from `src/lib/constants.ts`).
*/

CREATE TABLE IF NOT EXISTS compliance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'document',
  rule_type text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'Warning',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_user ON compliance_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_active ON compliance_policies(user_id, is_active);

ALTER TABLE compliance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_compliance_policies" ON compliance_policies;
CREATE POLICY "select_own_compliance_policies" ON compliance_policies FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_compliance_policies" ON compliance_policies;
CREATE POLICY "insert_own_compliance_policies" ON compliance_policies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_compliance_policies" ON compliance_policies;
CREATE POLICY "update_own_compliance_policies" ON compliance_policies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_compliance_policies" ON compliance_policies;
CREATE POLICY "delete_own_compliance_policies" ON compliance_policies FOR DELETE TO authenticated USING (auth.uid() = user_id);
