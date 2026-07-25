import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { checkRegistrationUnique, fetchVehicleFull } from "@/lib/queries";
import { generateSlug } from "@/lib/calc";
import { PAYMENT_METHODS } from "@/lib/constants";
import { PartyPickerField } from "@/components/PartyPickerField";
import { FileUploadGrid } from "@/components/FileUploadGrid";
import { VehicleFormFields, type VehicleCoreFormData } from "@/components/VehicleFormFields";
import { diffRemovedPaths, type UploadedFile } from "@/lib/uploadedFile";
import { syncVehicleAlerts } from "@/lib/compliance";
import type { Vehicle, Purchase, PurchasePayment } from "@/lib/types";

interface EditVehicleModalProps {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface PurchaseFormData {
  seller_party_id: string;
  purchase_price: string;
  broker_commission: string;
  other_fee: string;
  payment_method: string;
  payment_reference: string;
  handover_location: string;
  odometer_at_purchase: string;
  keys_received: boolean;
  documents_received: boolean;
}

function toFormData(vehicle: Vehicle): VehicleCoreFormData {
  return {
    category: vehicle.category,
    fuel_type: vehicle.fuel_type,
    manufacturer: vehicle.manufacturer,
    model: vehicle.model,
    registration_number: vehicle.registration_number ?? "",
    colour: vehicle.colour ?? "",
    manufacture_year: vehicle.manufacture_year ? String(vehicle.manufacture_year) : "",
    variant: vehicle.variant ?? "",
    brand: vehicle.brand ?? "",
    registration_date: vehicle.registration_date ?? "",
    chassis_number: vehicle.chassis_number ?? "",
    engine_number: vehicle.engine_number ?? "",
    odometer: vehicle.odometer !== null ? String(vehicle.odometer) : "",
    owner_count: String(vehicle.owner_count ?? 1),
    registration_city: vehicle.registration_city ?? "",
    registration_state: vehicle.registration_state ?? "",
    current_location: vehicle.current_location ?? "",
    asking_price: vehicle.asking_price !== null ? String(vehicle.asking_price) : "",
    minimum_price: vehicle.minimum_price !== null ? String(vehicle.minimum_price) : "",
  };
}

const emptyPurchaseForm: PurchaseFormData = {
  seller_party_id: "",
  purchase_price: "",
  broker_commission: "0",
  other_fee: "0",
  payment_method: "UPI",
  payment_reference: "",
  handover_location: "",
  odometer_at_purchase: "",
  keys_received: true,
  documents_received: false,
};

function toPurchaseFormData(purchase: Purchase, payment: PurchasePayment | undefined): PurchaseFormData {
  return {
    seller_party_id: purchase.seller_party_id ?? "",
    purchase_price: String(purchase.agreed_price ?? ""),
    broker_commission: String(purchase.broker_commission ?? 0),
    other_fee: String(purchase.other_fee ?? 0),
    payment_method: payment?.payment_method ?? "UPI",
    payment_reference: payment?.reference ?? "",
    handover_location: purchase.handover_location ?? "",
    odometer_at_purchase: purchase.odometer_at_purchase !== null ? String(purchase.odometer_at_purchase) : "",
    keys_received: purchase.keys_received,
    documents_received: purchase.documents_received,
  };
}

export function EditVehicleModal({ vehicle, open, onClose, onSaved }: EditVehicleModalProps) {
  const [form, setForm] = useState<VehicleCoreFormData>(() => toFormData(vehicle));
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(true);
  const [listingId, setListingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [loadingPurchase, setLoadingPurchase] = useState(true);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormData>(emptyPurchaseForm);
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  const [originalProofPaths, setOriginalProofPaths] = useState<string[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState(() => crypto.randomUUID());

  const { toast } = useToast();

  const updatePurchase = <K extends keyof PurchaseFormData>(key: K, value: PurchaseFormData[K]) => {
    setPurchaseForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    if (!open) return;
    setForm(toFormData(vehicle));
    setRegAvailable(true);
    setLoadingPurchase(true);
    setUploadSessionId(crypto.randomUUID());
    (async () => {
      const [{ data: listing }, full] = await Promise.all([
        supabase.from("listings").select("id").eq("vehicle_id", vehicle.id).maybeSingle(),
        fetchVehicleFull(vehicle.id),
      ]);
      setListingId(listing?.id ?? null);
      const purchase = full?.purchase ?? null;
      const payment = purchase?.payments?.[0];
      if (purchase) {
        setPurchaseId(purchase.id);
        setPaymentId(payment?.id ?? null);
        setPurchaseForm(toPurchaseFormData(purchase, payment));
        const existing = payment?.proof_urls ?? [];
        setProofFiles(existing.map((path) => ({ path, name: path.split("/").pop() ?? path })));
        setOriginalProofPaths(existing);
      } else {
        setPurchaseId(null);
        setPaymentId(null);
        setPurchaseForm(emptyPurchaseForm);
        setProofFiles([]);
        setOriginalProofPaths([]);
      }
      setLoadingPurchase(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle.id]);

  useEffect(() => {
    if (!open) return;
    const trimmed = form.registration_number.trim();
    if (!trimmed) {
      setRegAvailable(null);
      return;
    }
    if (trimmed === (vehicle.registration_number ?? "")) {
      setRegAvailable(true);
      return;
    }
    setRegChecking(true);
    const t = setTimeout(async () => {
      try {
        const ok = await checkRegistrationUnique(trimmed, vehicle.id);
        setRegAvailable(ok);
      } catch {
        setRegAvailable(null);
      } finally {
        setRegChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.registration_number, open, vehicle.id, vehicle.registration_number]);

  const update = <K extends keyof VehicleCoreFormData>(key: K, value: VehicleCoreFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const isValid = Boolean(
    form.manufacturer.trim() && form.model.trim() && form.registration_number.trim() && form.manufacture_year,
  ) && regAvailable === true;

  const handleSave = async () => {
    if (!isValid) {
      toast("Please complete all required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const askingPrice = Number(form.asking_price) || null;
      const minimumPrice = Number(form.minimum_price) || null;

      const { error } = await supabase.from("vehicles").update({
        registration_number: form.registration_number.trim(),
        category: form.category,
        manufacturer: form.manufacturer,
        brand: form.brand || form.manufacturer,
        model: form.model,
        variant: form.variant || null,
        fuel_type: form.fuel_type,
        colour: form.colour || null,
        manufacture_year: Number(form.manufacture_year) || null,
        registration_date: form.registration_date || null,
        chassis_number: form.chassis_number || null,
        engine_number: form.engine_number || null,
        odometer: form.odometer ? Number(form.odometer) : null,
        owner_count: Number(form.owner_count) || 1,
        registration_city: form.registration_city || null,
        registration_state: form.registration_state || null,
        current_location: form.current_location || null,
        asking_price: askingPrice,
        minimum_price: minimumPrice,
        updated_at: new Date().toISOString(),
      }).eq("id", vehicle.id);
      if (error) throw error;

      if (purchaseId) {
        const { error: purErr } = await supabase.from("purchases").update({
          seller_party_id: purchaseForm.seller_party_id || null,
          agreed_price: Number(purchaseForm.purchase_price) || 0,
          broker_commission: Number(purchaseForm.broker_commission) || 0,
          other_fee: Number(purchaseForm.other_fee) || 0,
          handover_location: purchaseForm.handover_location || null,
          odometer_at_purchase: purchaseForm.odometer_at_purchase ? Number(purchaseForm.odometer_at_purchase) : null,
          keys_received: purchaseForm.keys_received,
          documents_received: purchaseForm.documents_received,
        }).eq("id", purchaseId);
        if (purErr) throw purErr;

        const finalProofs = proofFiles.map((f) => f.path);
        const removedProofs = diffRemovedPaths(originalProofPaths, proofFiles);
        if (paymentId) {
          const { error: payErr } = await supabase.from("purchase_payments").update({
            amount: (Number(purchaseForm.purchase_price) || 0) + (Number(purchaseForm.broker_commission) || 0) + (Number(purchaseForm.other_fee) || 0),
            payment_method: purchaseForm.payment_method,
            reference: purchaseForm.payment_reference || null,
            proof_urls: finalProofs.length ? finalProofs : null,
          }).eq("id", paymentId);
          if (payErr) throw payErr;
        } else if (finalProofs.length || purchaseForm.payment_reference) {
          const { error: payErr } = await supabase.from("purchase_payments").insert({
            purchase_id: purchaseId,
            amount: (Number(purchaseForm.purchase_price) || 0) + (Number(purchaseForm.broker_commission) || 0) + (Number(purchaseForm.other_fee) || 0),
            payment_method: purchaseForm.payment_method,
            reference: purchaseForm.payment_reference || null,
            proof_urls: finalProofs.length ? finalProofs : null,
            paid_at: new Date().toISOString(),
          });
          if (payErr) throw payErr;
        }
        if (removedProofs.length) {
          await supabase.storage.from("finance-proofs").remove(removedProofs);
        }
        syncVehicleAlerts(vehicle.id).catch(() => {});
      }

      if (askingPrice && askingPrice > 0) {
        if (listingId) {
          const { error: listErr } = await supabase.from("listings").update({
            asking_price: askingPrice,
            minimum_price: minimumPrice,
          }).eq("id", listingId);
          if (listErr) {
            toast("Vehicle saved, but syncing the public listing price failed: " + listErr.message, "error");
            onSaved();
            onClose();
            return;
          }
        } else {
          const slugBase = `${form.manufacturer}-${form.model}-${form.manufacture_year}-${form.registration_number}`.toLowerCase();
          const { error: listErr } = await supabase.from("listings").insert({
            vehicle_id: vehicle.id,
            asking_price: askingPrice,
            minimum_price: minimumPrice,
            status: "Draft",
            description: `${form.manufacture_year} ${form.manufacturer} ${form.model}. ${form.odometer} km.`,
            public_slug: generateSlug(slugBase) + "-" + vehicle.id.slice(0, 6),
          });
          if (listErr) {
            toast("Vehicle saved, but creating the public listing failed: " + listErr.message, "error");
            onSaved();
            onClose();
            return;
          }
        }
      }

      toast("Vehicle updated", "success");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update vehicle", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${vehicle.stock_number}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={14} /> : null} Save Changes
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <VehicleFormFields form={form} update={update} regChecking={regChecking} regAvailable={regAvailable} defaultShowMore />

        <div className="border-t border-slate-200 pt-5">
          <h3 className="font-semibold text-slate-900 mb-4">Purchase</h3>
          {loadingPurchase ? (
            <div className="flex items-center justify-center py-8"><Spinner size={20} /></div>
          ) : !purchaseId ? (
            <p className="text-sm text-slate-500">No purchase record exists for this vehicle yet.</p>
          ) : (
            <div className="space-y-4">
              <PartyPickerField partyType="seller" value={purchaseForm.seller_party_id} onChange={(v) => updatePurchase("seller_party_id", v)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Purchase Price (₹)" required>
                  <input className="input" type="number" value={purchaseForm.purchase_price} onChange={(e) => updatePurchase("purchase_price", e.target.value)} />
                </Field>
                <Field label="Broker Commission (₹)">
                  <input className="input" type="number" value={purchaseForm.broker_commission} onChange={(e) => updatePurchase("broker_commission", e.target.value)} />
                </Field>
                <Field label="Other Fees (₹)">
                  <input className="input" type="number" value={purchaseForm.other_fee} onChange={(e) => updatePurchase("other_fee", e.target.value)} />
                </Field>
                <Field label="Payment Method">
                  <Select value={purchaseForm.payment_method} onChange={(v) => updatePurchase("payment_method", v)} options={PAYMENT_METHODS} />
                </Field>
                <Field label="Payment Reference">
                  <input className="input" value={purchaseForm.payment_reference} onChange={(e) => updatePurchase("payment_reference", e.target.value)} placeholder="UPI/XXXX" />
                </Field>
                <Field label="Handover Location">
                  <input className="input" value={purchaseForm.handover_location} onChange={(e) => updatePurchase("handover_location", e.target.value)} placeholder="Chennai" />
                </Field>
                <Field label="Odometer at Purchase">
                  <input className="input" type="number" value={purchaseForm.odometer_at_purchase} onChange={(e) => updatePurchase("odometer_at_purchase", e.target.value)} />
                </Field>
                <div className="flex items-center gap-6 pt-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={purchaseForm.keys_received} onChange={(e) => updatePurchase("keys_received", e.target.checked)} className="rounded border-slate-300" />
                    Keys received
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={purchaseForm.documents_received} onChange={(e) => updatePurchase("documents_received", e.target.checked)} className="rounded border-slate-300" />
                    Documents received
                  </label>
                </div>
              </div>

              <FileUploadGrid
                bucket="finance-proofs"
                pathPrefix={`purchase-payments/${uploadSessionId}`}
                value={proofFiles}
                onChange={setProofFiles}
                label="Payment Proof"
                hint="Add one screenshot per transaction — useful for partial payments, broker fees, or other charges paid separately."
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
