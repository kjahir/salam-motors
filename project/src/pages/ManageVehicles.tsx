import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike, Check, ExternalLink, Pencil, Plus, ShoppingCart, Spline, X } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, EmptyState } from "@/components/ui/Card";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { checkRegistrationUnique, fetchVehicles } from "@/lib/queries";
import { syncVehicleAlerts } from "@/lib/compliance";
import { AddVehicle } from "@/pages/AddVehicle";
import { VehicleDetail } from "@/pages/VehicleDetail";
import { VehicleDetailsForm } from "@/components/VehicleDetailsForm";
import { emptyVehicleForm, normalizeRegistration, normalizeUpperCase, type VehicleFullFormData } from "@/lib/vehicleForm";
import { diffRemovedPaths, fileFromPath, type UploadedFile } from "@/lib/uploadedFile";
import { vehicleLabel } from "@/lib/vehicleLabel";
import type { Purchase, PurchasePayment, Vehicle } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

const formFromVehicle = (v: Vehicle, purchase: Purchase | null, payment?: PurchasePayment): VehicleFullFormData => ({
  ...emptyVehicleForm(),
  registration_number: str(v.registration_number),
  category: v.category,
  manufacturer: v.manufacturer,
  brand: str(v.brand),
  model: v.model,
  variant: str(v.variant),
  fuel_type: v.fuel_type,
  colour: str(v.colour),
  manufacture_year: str(v.manufacture_year),
  registration_date: v.registration_date?.slice(0, 10) ?? "",
  chassis_number: str(v.chassis_number),
  engine_number: str(v.engine_number),
  odometer: str(v.odometer),
  owner_count: str(v.owner_count) || "1",
  registration_city: str(v.registration_city),
  registration_state: str(v.registration_state),
  current_location: str(v.current_location),
  asking_price: str(v.asking_price),
  minimum_price: str(v.minimum_price),
  notes: str(v.notes),
  seller_party_id: str(purchase?.seller_party_id),
  purchase_price: str(purchase?.agreed_price),
  broker_commission: str(purchase?.broker_commission) || "0",
  other_fee: str(purchase?.other_fee) || "0",
  handover_location: str(purchase?.handover_location),
  odometer_at_purchase: str(purchase?.odometer_at_purchase),
  keys_received: purchase?.keys_received ?? true,
  documents_received: purchase?.documents_received ?? false,
  payment_method: payment?.payment_method ?? "UPI",
  payment_reference: str(payment?.reference),
});

// Add Vehicle and Update Vehicle, clubbed: a vehicle picker with a "+" beside it. Pick a
// vehicle and its full record opens in the same form onboarding uses (shared via
// VehicleDetailsForm) ready to edit; hit "+" and you get the Add Vehicle screen itself
// (embedded, so there is one page heading). Replaces the old field-by-field
// UpdateVehicle page, which could only patch one attribute at a time.
export function ManageVehicles({ onNavigate }: { onNavigate: (page: PageKey, params?: NavigateParams) => void }) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [creating, setCreating] = useState(false);
  const [selling, setSelling] = useState(false);
  const [form, setForm] = useState<VehicleFullFormData>(emptyVehicleForm);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  /** Proof paths present when the vehicle was loaded, so a save can delete what was removed. */
  const [originalProofPaths, setOriginalProofPaths] = useState<string[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState(() => crypto.randomUUID());
  const [loadingVehicle, setLoadingVehicle] = useState(false);
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadVehicles = () => fetchVehicles().then(setVehicles).catch(() => setVehicles([]));

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    setLoadingVehicle(true);
    setUploadSessionId(crypto.randomUUID());
    (async () => {
      try {
        const [{ data: vehicle, error: vErr }, { data: purchaseRow }, { data: listing }] = await Promise.all([
          supabase.from("vehicles").select("*").eq("id", vehicleId).single(),
          supabase.from("purchases").select("*").eq("vehicle_id", vehicleId).maybeSingle(),
          supabase.from("listings").select("id").eq("vehicle_id", vehicleId).maybeSingle(),
        ]);
        if (vErr) throw vErr;
        const purchase = (purchaseRow as Purchase | null) ?? null;

        // A purchase can have several payments; the onboarding flow writes exactly one, so
        // that first (earliest) payment is the one this form edits. Extra payments are left
        // alone — record those from the vehicle's own Sale & Profit tab.
        const { data: payments } = purchase
          ? await supabase.from("purchase_payments").select("*").eq("purchase_id", purchase.id).order("paid_at")
          : { data: null };
        const payment = ((payments as PurchasePayment[] | null) ?? [])[0];
        if (cancelled) return;

        setForm(formFromVehicle(vehicle as Vehicle, purchase, payment));
        setPurchaseId(purchase?.id ?? null);
        setPaymentId(payment?.id ?? null);
        setListingId((listing as { id: string } | null)?.id ?? null);
        const existingProofs = payment?.proof_urls ?? [];
        setProofFiles(existingProofs.map(fileFromPath));
        setOriginalProofPaths(existingProofs);
        setRegAvailable(null);
      } catch (e) {
        if (!cancelled) toast(e instanceof Error ? e.message : t("vehicleDetail.failedToLoad"), "error");
      } finally {
        if (!cancelled) setLoadingVehicle(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const update = <K extends keyof VehicleFullFormData>(key: K, value: VehicleFullFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Same debounced uniqueness check as onboarding, but this vehicle's own registration
  // must not count as a clash.
  useEffect(() => {
    if (!vehicleId || !form.registration_number.trim()) {
      setRegAvailable(null);
      return;
    }
    setRegChecking(true);
    const handle = setTimeout(async () => {
      try {
        setRegAvailable(await checkRegistrationUnique(form.registration_number.trim(), vehicleId));
      } catch {
        setRegAvailable(null);
      } finally {
        setRegChecking(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form.registration_number, vehicleId]);

  const isValid = Boolean(
    form.manufacturer.trim() &&
    form.model.trim() &&
    form.registration_number.trim() &&
    form.manufacture_year &&
    form.purchase_price && Number(form.purchase_price) > 0,
  ) && regAvailable !== false;

  const handleSave = async () => {
    if (!isValid) {
      toast(t("vehicleForm.requiredMissing"), "error");
      return;
    }
    setSaving(true);
    try {
      const { error: vErr } = await supabase
        .from("vehicles")
        .update({
          registration_number: normalizeRegistration(form.registration_number.trim()),
          category: form.category,
          manufacturer: normalizeUpperCase(form.manufacturer.trim()),
          brand: form.brand.trim() || normalizeUpperCase(form.manufacturer.trim()),
          model: normalizeUpperCase(form.model.trim()),
          variant: form.variant.trim() || null,
          fuel_type: form.fuel_type,
          colour: form.colour.trim() || null,
          manufacture_year: Number(form.manufacture_year) || null,
          registration_date: form.registration_date || null,
          chassis_number: form.chassis_number.trim() || null,
          engine_number: form.engine_number.trim() || null,
          odometer: form.odometer ? Number(form.odometer) : null,
          owner_count: Number(form.owner_count) || 1,
          registration_city: form.registration_city.trim() || null,
          registration_state: form.registration_state.trim() || null,
          current_location: form.current_location.trim() || null,
          asking_price: Number(form.asking_price) || null,
          minimum_price: Number(form.minimum_price) || null,
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vehicleId);
      if (vErr) throw vErr;

      // The purchase row carries seller and price; a vehicle onboarded before this form
      // existed may not have one, so patch it only when it does.
      if (purchaseId) {
        const { error: pErr } = await supabase
          .from("purchases")
          .update({
            seller_party_id: form.seller_party_id || null,
            agreed_price: Number(form.purchase_price),
            broker_commission: Number(form.broker_commission) || 0,
            other_fee: Number(form.other_fee) || 0,
            handover_location: form.handover_location.trim() || null,
            odometer_at_purchase: form.odometer_at_purchase ? Number(form.odometer_at_purchase) : null,
            keys_received: form.keys_received,
            documents_received: form.documents_received,
          })
          .eq("id", purchaseId);
        if (pErr) throw pErr;

        // Payment amount is derived, not typed: the "Purchase payments must match price"
        // compliance rule reconciles total payments against price + commission + fees, so
        // it has to move whenever any of those three do.
        const paidTotal =
          (Number(form.purchase_price) || 0) + (Number(form.broker_commission) || 0) + (Number(form.other_fee) || 0);
        const finalProofs = proofFiles.map((f) => f.path);
        const removedProofs = diffRemovedPaths(originalProofPaths, proofFiles);

        if (paymentId) {
          const { error: payErr } = await supabase
            .from("purchase_payments")
            .update({
              amount: paidTotal,
              payment_method: form.payment_method,
              reference: form.payment_reference.trim() || null,
              proof_urls: finalProofs.length ? finalProofs : null,
            })
            .eq("id", paymentId);
          if (payErr) throw payErr;
        } else if (finalProofs.length || form.payment_reference.trim()) {
          // No payment on file yet — only create one once there is something to record,
          // so simply opening and saving the form can't invent a payment.
          const { data: created, error: payErr } = await supabase
            .from("purchase_payments")
            .insert({
              purchase_id: purchaseId,
              amount: paidTotal,
              payment_method: form.payment_method,
              reference: form.payment_reference.trim() || null,
              proof_urls: finalProofs.length ? finalProofs : null,
              paid_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (payErr) throw payErr;
          setPaymentId(created.id as string);
        }

        if (removedProofs.length) {
          const { error: rmErr } = await supabase.storage.from("finance-proofs").remove(removedProofs);
          if (rmErr) console.error("Failed to remove detached payment proofs", rmErr);
        }
        setOriginalProofPaths(finalProofs);
      }

      // Keep the public listing's price in step, the same way EditVehicleModal does —
      // otherwise editing the asking price here leaves the passport showing the old one.
      const askingPrice = Number(form.asking_price) || null;
      const minimumPrice = Number(form.minimum_price) || null;
      if (askingPrice && askingPrice > 0 && listingId) {
        const { error: listErr } = await supabase
          .from("listings")
          .update({ asking_price: askingPrice, minimum_price: minimumPrice })
          .eq("id", listingId);
        if (listErr) toast(t("vehicleForm.savedListingSyncFailed", { message: listErr.message }), "error");
      }

      supabase
        .from("audit_logs")
        .insert({ entity_type: "vehicle", entity_id: vehicleId, action: "updated", performed_by: user?.email ?? "Unknown" })
        .then(({ error }) => {
          if (error) console.error("Failed to log vehicle update", error);
        });

      toast(t("mobileUpdateVehicle.updated"), "success");
      syncVehicleAlerts(vehicleId).catch(() => {});
      loadVehicles();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("mobileUpdateVehicle.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setSelling(false);
    setVehicleId("");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader
        title={t("manageVehicles.title")}
        description={t("manageVehicles.description")}
        icon={<Bike size={20} />}
        actions={
          vehicleId ? (
            <button onClick={() => onNavigate("vehicle", { vehicleId })} className="btn-secondary">
              <ExternalLink size={16} /> {t("quickEntry.openVehicle")}
            </button>
          ) : undefined
        }
      />

      <Card className="p-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field label={t("manageVehicles.selectToEdit")}>
              {vehicles === null ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2">
                  <Spinner size={16} />
                </div>
              ) : (
                <Select
                  value={vehicleId}
                  onChange={(id) => {
                    setCreating(false);
                    setSelling(false);
                    setVehicleId(id);
                  }}
                  placeholder={t("mobileAdd.chooseVehicle")}
                  options={vehicles.map((v) => ({ value: v.id, label: vehicleLabel(v) }))}
                />
              )}
            </Field>
          </div>
          {/* Both actions are icon-only and sit beside the picker, and the picker decides
              which one is live: with nothing selected the only thing you can do is start a
              new vehicle; select one and selling it becomes the action. */}
          {creating ? (
            <button
              onClick={() => setCreating(false)}
              className="btn-secondary btn-icon"
              title={t("manageVehicles.cancelNew")}
              aria-label={t("manageVehicles.cancelNew")}
            >
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={startCreate}
              disabled={Boolean(vehicleId)}
              className="btn-primary btn-icon"
              title={t("manageVehicles.addNew")}
              aria-label={t("manageVehicles.addNew")}
            >
              <Plus size={16} />
            </button>
          )}
          {selling ? (
            <button
              onClick={() => setSelling(false)}
              className="btn-secondary btn-icon"
              title={t("vehicleDetail.edit")}
              aria-label={t("vehicleDetail.edit")}
            >
              <Pencil size={16} />
            </button>
          ) : (
            <button
              onClick={() => setSelling(true)}
              disabled={!vehicleId}
              className="btn-sell btn-icon"
              title={t("dashboard.sellVehicle")}
              aria-label={t("dashboard.sellVehicle")}
            >
              <ShoppingCart size={16} />
            </button>
          )}
        </div>
      </Card>

      {creating && (
        <AddVehicle
          onNavigate={onNavigate}
          embedded
          onCreated={(id) => {
            loadVehicles();
            setVehicleId(id);
          }}
        />
      )}

      {!creating && !vehicleId && (
        <Card className="p-6">
          <EmptyState icon={<Spline size={20} />} title={t("manageVehicles.emptyTitle")} description={t("manageVehicles.emptyDescription")} />
        </Card>
      )}

      {!creating && vehicleId && selling && (
        <VehicleDetail
          key={vehicleId}
          vehicleId={vehicleId}
          onNavigate={onNavigate}
          onBack={() => setSelling(false)}
          initialTab="sale"
          embedded
        />
      )}

      {!creating && vehicleId && !selling && loadingVehicle && (
        <div className="flex items-center justify-center py-12"><Spinner size={28} /></div>
      )}

      {!creating && vehicleId && !selling && !loadingVehicle && (
        <VehicleDetailsForm
          form={form}
          update={update}
          regChecking={regChecking}
          regAvailable={regAvailable}
          paymentProofs={proofFiles}
          onPaymentProofsChange={setProofFiles}
          uploadPathPrefix={`purchase-payments/${uploadSessionId}`}
          footer={
            <button onClick={handleSave} disabled={saving || !isValid} className="btn-primary">
              {saving ? <Spinner size={16} /> : <Check size={16} />} {t("manageVehicles.saveChanges")}
            </button>
          }
        />
      )}
    </div>
  );
}
