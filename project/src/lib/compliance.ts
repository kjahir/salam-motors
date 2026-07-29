import { supabase } from "./supabase";
import type { CompliancePolicy, VehicleWithRelations } from "./types";

export interface ComplianceViolation {
  policyId: string;
  name: string;
  category: string;
  severity: string;
  ruleType: string;
  resolutionMode: string;
}

// A violation is a genuine hard blocker on completing a sale only when its policy is
// `auto_only` — the two default policies (RC book, purchase-payments-must-match-price) plus
// any custom policy an admin has deliberately marked the same way. Every other violation is
// dealer-acknowledgeable: it stays visible and actionable, but doesn't stop the sale.
export function isHardBlocking(violation: Pick<ComplianceViolation, "resolutionMode">): boolean {
  return violation.resolutionMode === "auto_only";
}

interface ViolatedRow {
  policy_id: string;
  name: string;
  category: string;
  severity: string;
}

// Client-side mirror of the is_policy_violated() SQL function, run over an
// already-fetched VehicleWithRelations (documents/expenses/investments/
// purchase.payments) — same pattern as documentCompleteness()/computeOverallScore()
// in calc.ts. No extra round trip: fetchVehicleFull() already loads everything needed.

function isDocumentSatisfied(vehicle: VehicleWithRelations, policy: CompliancePolicy): boolean {
  const documentType = policy.params.document_type as string | undefined;
  if (!documentType) return true;
  const acceptedStatuses = (policy.params.accepted_statuses as string[] | undefined) ?? ["Verified", "Uploaded"];
  return (vehicle.documents ?? []).some(
    (d) => d.document_type === documentType && acceptedStatuses.includes(d.verification_status),
  );
}

function hasMissingEvidence(vehicle: VehicleWithRelations, policy: CompliancePolicy): boolean {
  const entity = policy.params.entity as string | undefined;
  if (entity === "purchase_payment") {
    return (vehicle.purchase?.payments ?? []).some((p) => !p.proof_urls || p.proof_urls.length === 0);
  }
  if (entity === "expense") {
    return (vehicle.expenses ?? [])
      .filter((e) => !["Draft", "Rejected", "Reversed"].includes(e.approval_status))
      .some((e) => !e.bill_urls || e.bill_urls.length === 0);
  }
  if (entity === "investment") {
    return (vehicle.investments ?? []).some((i) => !i.proof_urls || i.proof_urls.length === 0);
  }
  return false;
}

function isAmountMismatched(vehicle: VehicleWithRelations, policy: CompliancePolicy): boolean {
  const purchase = vehicle.purchase;
  if (!purchase) return false;
  const tolerance = typeof policy.params.tolerance === "number" ? policy.params.tolerance : 0.01;
  const paid = (purchase.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const expected = purchase.agreed_price + purchase.broker_commission + purchase.other_fee;
  return Math.abs(paid - expected) > tolerance;
}

export function evaluateVehicleCompliance(vehicle: VehicleWithRelations, policies: CompliancePolicy[]): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  for (const policy of policies) {
    if (!policy.is_active) continue;
    let violated = false;
    if (policy.rule_type === "document_required") violated = !isDocumentSatisfied(vehicle, policy);
    else if (policy.rule_type === "evidence_required") violated = hasMissingEvidence(vehicle, policy);
    else if (policy.rule_type === "amount_reconciliation") violated = isAmountMismatched(vehicle, policy);
    if (violated) {
      violations.push({
        policyId: policy.id,
        name: policy.name,
        category: policy.category,
        severity: policy.severity,
        ruleType: policy.rule_type,
        resolutionMode: policy.resolution_mode,
      });
    }
  }
  return violations;
}

// Which record(s) are the actual offenders for a violated policy, when identifiable — used to
// scroll-to/highlight the exact row on the Documents/Expenses tabs. Not every rule_type maps to
// a single row: purchase_payment evidence and amount_reconciliation are fixed as a whole via the
// Edit Vehicle modal (the proof grid / price fields), not one specific table row, so those (and
// investment evidence, which has no edit UI yet) return an empty list on purpose.
export function findViolatingRecordIds(vehicle: VehicleWithRelations, policy: CompliancePolicy): string[] {
  if (policy.rule_type === "document_required") {
    const documentType = policy.params.document_type as string | undefined;
    if (!documentType) return [];
    const acceptedStatuses = (policy.params.accepted_statuses as string[] | undefined) ?? ["Verified", "Uploaded"];
    return (vehicle.documents ?? [])
      .filter((d) => d.document_type === documentType && !acceptedStatuses.includes(d.verification_status))
      .map((d) => d.id);
  }
  if (policy.rule_type === "evidence_required" && policy.params.entity === "expense") {
    return (vehicle.expenses ?? [])
      .filter((e) => !["Draft", "Rejected", "Reversed"].includes(e.approval_status))
      .filter((e) => !e.bill_urls || e.bill_urls.length === 0)
      .map((e) => e.id);
  }
  return [];
}

export interface AlertDestination {
  tab?: string;
  openEditVehicle?: boolean;
}

// Where clicking an alert for this policy should land: which VehicleDetail tab, and whether to
// auto-open the Edit Vehicle modal. An undefined policy (legacy Ageing/Document/Repair alerts
// with no compliance policy behind them) yields no special destination — those keep today's
// plain vehicle navigation.
export function resolveAlertDestination(policy: CompliancePolicy | undefined): AlertDestination {
  if (!policy) return {};
  if (policy.rule_type === "document_required") return { tab: "documents" };
  if (policy.rule_type === "evidence_required" && policy.params.entity === "expense") return { tab: "expenses" };
  if (policy.rule_type === "evidence_required" && policy.params.entity === "purchase_payment") return { tab: "overview", openEditVehicle: true };
  if (policy.rule_type === "amount_reconciliation") return { tab: "overview", openEditVehicle: true };
  return { tab: "overview" };
}

// Diffs currently-violated policies for one vehicle against its active ('Open'/'Acknowledged')
// Compliance alerts: resolves alerts whose violation cleared (or whose policy was deleted/
// deactivated), inserts alerts for newly-violated policies with no active alert yet. Never
// touches already-Resolved rows or legacy alert types (policy_id IS NULL).
async function upsertAlertsForVehicle(vehicleId: string, violated: ViolatedRow[]): Promise<void> {
  const { data: activeAlerts, error: activeErr } = await supabase
    .from("alerts")
    .select("id, policy_id")
    .eq("vehicle_id", vehicleId)
    .eq("alert_type", "Compliance")
    .not("policy_id", "is", null)
    .in("status", ["Open", "Acknowledged"]);
  if (activeErr) throw activeErr;

  const violatedPolicyIds = new Set(violated.map((v) => v.policy_id));
  const activePolicyIds = new Set((activeAlerts ?? []).map((a) => a.policy_id as string));

  const toResolve = (activeAlerts ?? []).filter((a) => !violatedPolicyIds.has(a.policy_id as string)).map((a) => a.id);
  if (toResolve.length > 0) {
    const { error } = await supabase
      .from("alerts")
      .update({ status: "Resolved", resolved_at: new Date().toISOString() })
      .in("id", toResolve);
    if (error) throw error;
  }

  const toInsert = violated.filter((v) => !activePolicyIds.has(v.policy_id));
  for (const v of toInsert) {
    const { error } = await supabase.from("alerts").insert({
      vehicle_id: vehicleId,
      alert_type: "Compliance",
      policy_id: v.policy_id,
      severity: v.severity,
      title: v.name,
      message: `Compliance policy "${v.name}" (${v.category.replace(/_/g, " ")}) is currently violated.`,
    });
    // 23505 = unique-violation from uq_alerts_active_policy — a concurrent sync already
    // inserted the row this one needed; benign, swallow it.
    if (error && (error as { code?: string }).code !== "23505") throw error;
  }
}

export async function syncVehicleAlerts(vehicleId: string): Promise<void> {
  const { data, error } = await supabase
    .from("vehicle_compliance_violations")
    .select("policy_id, name, category, severity")
    .eq("vehicle_id", vehicleId)
    .eq("violated", true);
  if (error) throw error;
  await upsertAlertsForVehicle(vehicleId, (data ?? []) as ViolatedRow[]);
}

// Acknowledges the Open alert (if any) backing a manual-resolution violation — same
// status/acknowledged_at update Alerts.tsx's handleAction("acknowledge") does, just reached
// from a policyId instead of an alert id. Used by the OverviewTab violation list and the
// Record Sale "acknowledge and proceed" control, both of which only have the live violation
// (policyId), not necessarily an already-synced alert row. Syncs first so a violation that
// hasn't had its alert row created/updated yet (e.g. just-edited data) still resolves to one.
// auto_only violations are never passed here — the UI never offers Acknowledge for them.
// The sync is best-effort (swallowed on failure), same as every other syncVehicleAlerts call
// site in this codebase — e.g. an unrelated auto_only alert that the DB won't let this sync
// auto-resolve outside sync_org_compliance_alerts() must not block acknowledging this one.
export async function acknowledgeViolation(vehicleId: string, policyId: string): Promise<void> {
  await syncVehicleAlerts(vehicleId).catch(() => {});
  const { data, error } = await supabase
    .from("alerts")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("policy_id", policyId)
    .eq("status", "Open")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return; // violation cleared before we could acknowledge it — nothing to do
  const { error: updErr } = await supabase
    .from("alerts")
    .update({ status: "Acknowledged", acknowledged_at: new Date().toISOString() })
    .eq("id", data.id);
  if (updErr) throw updErr;
}

export async function syncAllVehiclesCompliance(): Promise<void> {
  const { data, error } = await supabase
    .from("vehicle_compliance_violations")
    .select("vehicle_id, policy_id, name, category, severity")
    .eq("violated", true);
  if (error) throw error;

  const byVehicle = new Map<string, ViolatedRow[]>();
  for (const row of (data ?? []) as (ViolatedRow & { vehicle_id: string })[]) {
    const list = byVehicle.get(row.vehicle_id) ?? [];
    list.push(row);
    byVehicle.set(row.vehicle_id, list);
  }

  // A vehicle whose violations just dropped to zero has no row above, but may still have
  // active alerts to resolve — so also sweep any vehicle with a currently-active Compliance alert.
  const { data: activeVehicles, error: activeErr } = await supabase
    .from("alerts")
    .select("vehicle_id")
    .eq("alert_type", "Compliance")
    .not("policy_id", "is", null)
    .in("status", ["Open", "Acknowledged"]);
  if (activeErr) throw activeErr;

  const vehicleIds = new Set<string>([...byVehicle.keys(), ...(activeVehicles ?? []).map((a) => a.vehicle_id)]);
  await Promise.all(Array.from(vehicleIds).map((vehicleId) => upsertAlertsForVehicle(vehicleId, byVehicle.get(vehicleId) ?? [])));
}
