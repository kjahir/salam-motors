/*
# Comprehensive investment capture and profit settlement

## Overview
The Partners page can display investment and settlement figures but has no
way to actually record either — investments and profit-distribution payouts
were previously only ever written by the (now-removed) per-vehicle
Investment tab and a single-click "Mark Paid" action. This migration adds
what's needed to record both properly, including a transaction screenshot
as proof, from the Partners page.

## Changes
1. `investments.proof_url` — path to an uploaded screenshot/receipt in the
   new private `finance-proofs` bucket, for a specific investment.
2. `profit_settlement_payments` — a line-item ledger of settlement payments
   against a `profit_distributions` row, mirroring the existing
   `purchase_payments` / `sale_payments` pattern. This is what makes partial
   settlements possible (a distribution can be paid down over several
   transactions, each with its own method/reference/proof), rather than the
   previous single-click "pay it all now".
3. `finance-proofs` storage bucket — private, authenticated-only, for both
   investment and settlement-payment screenshots. Same posture as the
   `vehicle-documents` bucket (private + signed URLs, no public reads).
*/

ALTER TABLE investments ADD COLUMN IF NOT EXISTS proof_url text;

CREATE TABLE IF NOT EXISTS profit_settlement_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES profit_distributions(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'Bank transfer',
  reference text,
  proof_url text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settlement_payments_distribution ON profit_settlement_payments(distribution_id);

ALTER TABLE profit_settlement_payments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profit_settlement_payments ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE profit_settlement_payments ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_settlement_payments_user_id ON profit_settlement_payments(user_id);

ALTER TABLE profit_settlement_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profit_settlement_payments" ON profit_settlement_payments;
CREATE POLICY "select_own_profit_settlement_payments" ON profit_settlement_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_profit_settlement_payments" ON profit_settlement_payments;
CREATE POLICY "insert_own_profit_settlement_payments" ON profit_settlement_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_profit_settlement_payments" ON profit_settlement_payments;
CREATE POLICY "update_own_profit_settlement_payments" ON profit_settlement_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_profit_settlement_payments" ON profit_settlement_payments;
CREATE POLICY "delete_own_profit_settlement_payments" ON profit_settlement_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
  VALUES ('finance-proofs', 'finance-proofs', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_finance_proofs" ON storage.objects;
CREATE POLICY "auth_upload_finance_proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-proofs');

DROP POLICY IF EXISTS "auth_read_finance_proofs" ON storage.objects;
CREATE POLICY "auth_read_finance_proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'finance-proofs');

DROP POLICY IF EXISTS "auth_delete_finance_proofs" ON storage.objects;
CREATE POLICY "auth_delete_finance_proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'finance-proofs');
