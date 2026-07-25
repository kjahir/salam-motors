/*
# Compliance evaluation + alert linkage

## Overview
Wires `compliance_policies` (previous migration) up to two things:
1. `alerts.policy_id` — links an alert row back to the policy that
   generated it, and a partial unique index that guarantees at most one
   active (Open/Acknowledged) alert per (vehicle, policy) pair. This is
   what lets the app's sync logic be a plain diff instead of fuzzy
   title-matching, and guarantees legacy Ageing/Document/Repair alerts
   (policy_id IS NULL) are never touched by it.
2. `is_policy_violated()` — a SQL interpreter for the 3 rule_type shapes,
   and two views built on it:
   - `vehicle_compliance_violations` — one row per (vehicle, policy),
     `violated` boolean. Used by the app's alert-sync diff.
   - `vehicle_compliance_status` — one row per vehicle, aggregated
     violation count + worst severity + violation list (jsonb). Used for
     the color-coded health badge on vehicle lists (Inventory, Dashboard,
     mobile equivalents) — a live view, same posture as the existing
     `vehicle_financial_summary` view, so editing a policy changes what
     the very next read computes with zero cache to invalidate.

Both views are `security_invoker` so they respect the querying user's
RLS, matching how every other table in this app is owner-scoped.
*/

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES compliance_policies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_policy ON alerts(policy_id);

DROP INDEX IF EXISTS uq_alerts_active_policy;
CREATE UNIQUE INDEX uq_alerts_active_policy ON alerts(vehicle_id, policy_id)
  WHERE policy_id IS NOT NULL AND status IN ('Open', 'Acknowledged');

CREATE OR REPLACE FUNCTION public.is_policy_violated(p_vehicle_id uuid, p_policy compliance_policies)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
  IF NOT p_policy.is_active THEN
    RETURN false;
  END IF;

  IF p_policy.rule_type = 'document_required' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM vehicle_documents d
      WHERE d.vehicle_id = p_vehicle_id
        AND d.document_type = p_policy.params->>'document_type'
        AND d.verification_status = ANY (
          CASE WHEN p_policy.params ? 'accepted_statuses'
            THEN ARRAY(SELECT jsonb_array_elements_text(p_policy.params->'accepted_statuses'))
            ELSE ARRAY['Verified','Uploaded']
          END
        )
    );

  ELSIF p_policy.rule_type = 'evidence_required' THEN
    IF p_policy.params->>'entity' = 'purchase_payment' THEN
      RETURN EXISTS (
        SELECT 1 FROM purchase_payments pp
        JOIN purchases pu ON pu.id = pp.purchase_id
        WHERE pu.vehicle_id = p_vehicle_id
          AND (pp.proof_urls IS NULL OR cardinality(pp.proof_urls) = 0)
      );
    ELSIF p_policy.params->>'entity' = 'expense' THEN
      RETURN EXISTS (
        SELECT 1 FROM expenses e
        WHERE e.vehicle_id = p_vehicle_id
          AND e.approval_status NOT IN ('Draft', 'Rejected', 'Reversed')
          AND (e.bill_urls IS NULL OR cardinality(e.bill_urls) = 0)
      );
    ELSIF p_policy.params->>'entity' = 'investment' THEN
      RETURN EXISTS (
        SELECT 1 FROM investments i
        WHERE i.vehicle_id = p_vehicle_id
          AND (i.proof_urls IS NULL OR cardinality(i.proof_urls) = 0)
      );
    ELSE
      RETURN false;
    END IF;

  ELSIF p_policy.rule_type = 'amount_reconciliation' THEN
    RETURN EXISTS (
      SELECT 1 FROM purchases pu
      LEFT JOIN (SELECT purchase_id, SUM(amount) AS paid FROM purchase_payments GROUP BY purchase_id) pp
        ON pp.purchase_id = pu.id
      WHERE pu.vehicle_id = p_vehicle_id
        AND ABS(COALESCE(pp.paid, 0) - (pu.agreed_price + pu.broker_commission + pu.other_fee))
            > COALESCE((p_policy.params->>'tolerance')::numeric, 0.01)
    );

  ELSE
    RETURN false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_policy_violated(uuid, compliance_policies) TO authenticated;

CREATE OR REPLACE VIEW vehicle_compliance_violations AS
SELECT
  v.id AS vehicle_id,
  p.id AS policy_id,
  p.name, p.category, p.severity, p.rule_type, p.params,
  is_policy_violated(v.id, p) AS violated
FROM vehicles v
JOIN compliance_policies p ON p.user_id = v.user_id AND p.is_active;

ALTER VIEW vehicle_compliance_violations SET (security_invoker = true);

CREATE OR REPLACE VIEW vehicle_compliance_status AS
SELECT
  v.id AS vehicle_id,
  COALESCE(COUNT(*) FILTER (WHERE vcv.violated), 0) AS violation_count,
  COALESCE(MAX(CASE WHEN vcv.violated THEN
    CASE vcv.severity WHEN 'Critical' THEN 4 WHEN 'High' THEN 3 WHEN 'Warning' THEN 2 WHEN 'Info' THEN 1 ELSE 0 END
  END), 0) AS max_severity_rank,
  COALESCE(jsonb_agg(jsonb_build_object(
    'policy_id', vcv.policy_id, 'name', vcv.name, 'category', vcv.category, 'severity', vcv.severity
  )) FILTER (WHERE vcv.violated), '[]'::jsonb) AS violations
FROM vehicles v
LEFT JOIN vehicle_compliance_violations vcv ON vcv.vehicle_id = v.id
GROUP BY v.id;

ALTER VIEW vehicle_compliance_status SET (security_invoker = true);
