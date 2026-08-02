import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, AlertTriangle } from "lucide-react";
import { TopBar, Field, Input, Select, Button, Spinner, Card } from "./ui/primitives";
import { PartyPickerField } from "@/components/PartyPickerField";
import { FileUploadGrid } from "./ui/FileUploadGrid";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { checkRegistrationUnique, fetchVehicleFull } from "@/lib/queries";
import { createVehicle } from "@/lib/vehicle";
import { generateSlug } from "@/lib/calc";
import { VEHICLE_CATEGORIES, FUEL_TYPES, PAYMENT_METHODS } from "@/lib/constants";
import { normalizeRegistration } from "@/lib/vehicleForm";
import { diffRemovedPaths, type UploadedFile } from "@/lib/uploadedFile";
import { syncVehicleAlerts } from "@/lib/compliance";
import type { Vehicle } from "@/lib/types";
import type { MobileNavigate } from "./MobileApp";

interface CoreForm {
  registration_number: string;
  category: string;
  manufacturer: string;
  model: string;
  fuel_type: string;
  colour: string;
  manufacture_year: string;
  odometer: string;
  asking_price: string;
  minimum_price: string;
}

const initialCore: CoreForm = {
  registration_number: "",
  category: VEHICLE_CATEGORIES[0],
  manufacturer: "",
  model: "",
  fuel_type: FUEL_TYPES[0],
  colour: "",
  manufacture_year: String(new Date().getFullYear() - 2),
  odometer: "",
  asking_price: "",
  minimum_price: "",
};

interface PurchaseForm {
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

const emptyPurchaseForm: PurchaseForm = {
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

interface MobileVehicleFormProps {
  mode: "create" | "edit";
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
  /** Rendered under the picker on MobileUpdateVehicle, which owns the screen heading. */
  embedded?: boolean;
}

export function MobileVehicleForm({ mode, vehicleId, onNavigate, onBack, embedded }: MobileVehicleFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CoreForm>(initialCore);
  const [sellerPartyId, setSellerPartyId] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(mode === "edit" ? true : null);
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Edit-mode purchase record (mobile onboarding only ever captures purchase price;
  // the rest is filled in later here once a stock number and purchase row exist).
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(emptyPurchaseForm);
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  const [originalProofPaths, setOriginalProofPaths] = useState<string[]>([]);
  const [uploadSessionId] = useState(() => crypto.randomUUID());

  const update = <K extends keyof CoreForm>(key: K, value: CoreForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const updatePurchase = <K extends keyof PurchaseForm>(key: K, value: PurchaseForm[K]) => setPurchaseForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (mode !== "edit" || !vehicleId) return;
    let cancelled = false;
    (async () => {
      // loading has to clear on every path: this form is now reached by picking any
      // vehicle from a dropdown, so a failed or empty fetch used to strand the screen
      // on a spinner with no way back.
      let full: Awaited<ReturnType<typeof fetchVehicleFull>> = null;
      try {
        full = await fetchVehicleFull(vehicleId);
      } catch (e) {
        if (!cancelled) toast(e instanceof Error ? e.message : t("vehicleDetail.failedToLoad"), "error");
      }
      if (cancelled) return;
      if (!full) {
        setLoading(false);
        return;
      }
      setVehicle(full);
      setForm({
        registration_number: full.registration_number ?? "",
        category: full.category,
        manufacturer: full.manufacturer,
        model: full.model,
        fuel_type: full.fuel_type,
        colour: full.colour ?? "",
        manufacture_year: full.manufacture_year ? String(full.manufacture_year) : "",
        odometer: full.odometer !== null ? String(full.odometer) : "",
        asking_price: full.asking_price !== null ? String(full.asking_price) : "",
        minimum_price: full.minimum_price !== null ? String(full.minimum_price) : "",
      });
      const purchase = full.purchase ?? null;
      const payment = purchase?.payments?.[0];
      if (purchase) {
        setPurchaseId(purchase.id);
        setPaymentId(payment?.id ?? null);
        setPurchaseForm({
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
        });
        const existing = payment?.proof_urls ?? [];
        setProofFiles(existing.map((path) => ({ path, name: path.split("/").pop() ?? path })));
        setOriginalProofPaths(existing);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, vehicleId]);

  useEffect(() => {
    const trimmed = form.registration_number.trim();
    if (!trimmed) {
      setRegAvailable(null);
      return;
    }
    if (mode === "edit" && trimmed === (vehicle?.registration_number ?? "")) {
      setRegAvailable(true);
      return;
    }
    setRegChecking(true);
    const t = setTimeout(async () => {
      try {
        const ok = await checkRegistrationUnique(trimmed, mode === "edit" ? vehicleId : undefined);
        setRegAvailable(ok);
      } catch {
        setRegAvailable(null);
      } finally {
        setRegChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.registration_number, mode, vehicleId, vehicle?.registration_number]);

  const isValid =
    Boolean(form.manufacturer.trim() && form.model.trim() && form.registration_number.trim() && form.manufacture_year) &&
    regAvailable === true &&
    (mode === "edit" || Boolean(sellerPartyId && purchasePrice && Number(purchasePrice) > 0));

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const v = await createVehicle(
        {
          registration_number: form.registration_number,
          category: form.category,
          manufacturer: form.manufacturer,
          brand: form.manufacturer,
          model: form.model,
          variant: "",
          fuel_type: form.fuel_type,
          colour: form.colour,
          manufacture_year: form.manufacture_year,
          registration_date: "",
          chassis_number: "",
          engine_number: "",
          odometer: form.odometer,
          owner_count: "1",
          registration_city: "",
          registration_state: "",
          current_location: "",
          asking_price: form.asking_price,
          minimum_price: form.minimum_price,
          notes: "",
          seller_party_id: sellerPartyId,
          purchase_price: purchasePrice,
          broker_commission: "0",
          other_fee: "0",
          payment_method: "Cash",
          payment_reference: "",
          payment_proof_paths: [],
          handover_location: "",
          odometer_at_purchase: form.odometer,
          keys_received: true,
          documents_received: false,
        },
        user?.email ?? "Unknown",
      );
      toast(t("vehicleForm.onboardSuccess", { stock: v.stock_number }), "success");
      onNavigate("vehicle", { vehicleId: v.id });
    } catch (e) {
      toast(e instanceof Error ? t("vehicleForm.mobileRollback", { message: e.message }) : t("vehicleForm.createFailedRollback"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!vehicleId) return;
    setSubmitting(true);
    try {
      const askingPrice = Number(form.asking_price) || null;
      const minimumPrice = Number(form.minimum_price) || null;
      const { error } = await supabase.from("vehicles").update({
        registration_number: normalizeRegistration(form.registration_number.trim()),
        category: form.category,
        manufacturer: form.manufacturer,
        brand: form.manufacturer,
        model: form.model,
        fuel_type: form.fuel_type,
        colour: form.colour || null,
        manufacture_year: Number(form.manufacture_year) || null,
        odometer: form.odometer ? Number(form.odometer) : null,
        asking_price: askingPrice,
        minimum_price: minimumPrice,
        updated_at: new Date().toISOString(),
      }).eq("id", vehicleId);
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
        const amount = (Number(purchaseForm.purchase_price) || 0) + (Number(purchaseForm.broker_commission) || 0) + (Number(purchaseForm.other_fee) || 0);
        if (paymentId) {
          const { error: payErr } = await supabase.from("purchase_payments").update({
            amount,
            payment_method: purchaseForm.payment_method,
            reference: purchaseForm.payment_reference || null,
            proof_urls: finalProofs.length ? finalProofs : null,
          }).eq("id", paymentId);
          if (payErr) throw payErr;
        } else if (finalProofs.length || purchaseForm.payment_reference) {
          const { error: payErr } = await supabase.from("purchase_payments").insert({
            purchase_id: purchaseId,
            amount,
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
        syncVehicleAlerts(vehicleId).catch(() => {});
      }

      if (askingPrice && askingPrice > 0) {
        const { data: existingListing } = await supabase.from("listings").select("id").eq("vehicle_id", vehicleId).maybeSingle();
        if (existingListing) {
          await supabase.from("listings").update({ asking_price: askingPrice, minimum_price: minimumPrice }).eq("id", existingListing.id);
        } else {
          const slugBase = `${form.manufacturer}-${form.model}-${form.manufacture_year}-${form.registration_number}`.toLowerCase();
          await supabase.from("listings").insert({
            vehicle_id: vehicleId,
            asking_price: askingPrice,
            minimum_price: minimumPrice,
            status: "Draft",
            description: `${form.manufacture_year} ${form.manufacturer} ${form.model}. ${form.odometer} km.`,
            public_slug: generateSlug(slugBase) + "-" + vehicleId.slice(0, 6),
          });
        }
      }

      toast(t("vehicleForm.vehicleUpdated"), "success");
      onNavigate("vehicle", { vehicleId });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("vehicleForm.updateFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        {!embedded && <TopBar title={mode === "create" ? t("vehicleForm.onboardTitle") : t("vehicleForm.editVehicle")} onBack={onBack} />}
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  return (
    <div>
      {!embedded && <TopBar title={mode === "create" ? t("vehicleForm.onboardTitle") : t("vehicleForm.editTitle", { stock: vehicle?.stock_number ?? "" })} onBack={onBack} />}
      <div className="p-4 space-y-4 pb-28">
        <Card className="p-4 space-y-4">
          <Field label={t("vehicleForm.category")} required>
            <Select value={form.category} onChange={(v) => update("category", v)} options={VEHICLE_CATEGORIES} />
          </Field>
          <Field label={t("vehicleForm.fuelType")} required>
            <Select value={form.fuel_type} onChange={(v) => update("fuel_type", v)} options={FUEL_TYPES} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("vehicleForm.manufacturer")} required>
              <Input value={form.manufacturer} onChange={(e) => update("manufacturer", e.target.value)} placeholder="Honda" />
            </Field>
            <Field label={t("vehicleForm.model")} required>
              <Input value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="Activa 6G" />
            </Field>
          </div>
          <Field label={t("vehicleForm.registrationNumber")} required hint={regAvailable === false ? undefined : t("vehicleForm.mustBeUnique")}>
            <div className="relative">
              <Input
                value={form.registration_number}
                onChange={(e) => update("registration_number", normalizeRegistration(e.target.value))}
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="TN 22 AB 1234"
                className={regAvailable === false ? "border-mobile-error" : regAvailable === true ? "border-mobile-success" : ""}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {regChecking ? <Spinner size={14} /> : regAvailable === true ? <Check size={16} className="text-mobile-success" /> : regAvailable === false ? <AlertTriangle size={16} className="text-mobile-error" /> : null}
              </div>
            </div>
            {regAvailable === false && <p className="text-xs text-mobile-error mt-1">{t("vehicleForm.alreadyInUse")}</p>}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("vehicleForm.year")} required>
              <Input type="number" value={form.manufacture_year} onChange={(e) => update("manufacture_year", e.target.value)} />
            </Field>
            <Field label={t("vehicleForm.colour")}>
              <Input value={form.colour} onChange={(e) => update("colour", e.target.value)} placeholder="Black" />
            </Field>
          </div>
          <Field label={t("vehicleForm.odometer")}>
            <Input type="number" value={form.odometer} onChange={(e) => update("odometer", e.target.value)} placeholder="18500" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("vehicleForm.askingPrice")}>
              <Input type="number" value={form.asking_price} onChange={(e) => update("asking_price", e.target.value)} placeholder="79000" />
            </Field>
            <Field label={t("vehicleForm.minimumPrice")}>
              <Input type="number" value={form.minimum_price} onChange={(e) => update("minimum_price", e.target.value)} placeholder="70000" />
            </Field>
          </div>
        </Card>

        {mode === "create" && (
          <>
            <Card className="p-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">{t("vehicleForm.seller")}</h3>
              <PartyPickerField partyType="seller" value={sellerPartyId} onChange={setSellerPartyId} />
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">{t("vehicleForm.purchase")}</h3>
              <Field label={t("vehicleForm.purchasePrice")} required>
                <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="62000" />
              </Field>
            </Card>
          </>
        )}

        {mode === "edit" && purchaseId && (
          <>
            <Card className="p-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">{t("vehicleForm.seller")}</h3>
              <PartyPickerField partyType="seller" value={purchaseForm.seller_party_id} onChange={(v) => updatePurchase("seller_party_id", v)} />
            </Card>
            <Card className="p-4 space-y-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text">{t("vehicleForm.purchase")}</h3>
              <Field label={t("vehicleForm.purchasePrice")} required>
                <Input type="number" value={purchaseForm.purchase_price} onChange={(e) => updatePurchase("purchase_price", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("vehicleForm.brokerCommission")}>
                  <Input type="number" value={purchaseForm.broker_commission} onChange={(e) => updatePurchase("broker_commission", e.target.value)} />
                </Field>
                <Field label={t("vehicleForm.otherFees")}>
                  <Input type="number" value={purchaseForm.other_fee} onChange={(e) => updatePurchase("other_fee", e.target.value)} />
                </Field>
              </div>
              <Field label={t("vehicleForm.paymentMethod")}>
                <Select value={purchaseForm.payment_method} onChange={(v) => updatePurchase("payment_method", v)} options={PAYMENT_METHODS} />
              </Field>
              <Field label={t("vehicleForm.paymentReference")}>
                <Input value={purchaseForm.payment_reference} onChange={(e) => updatePurchase("payment_reference", e.target.value)} placeholder="UPI/XXXX" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("vehicleForm.handoverLocation")}>
                  <Input value={purchaseForm.handover_location} onChange={(e) => updatePurchase("handover_location", e.target.value)} placeholder="Chennai" />
                </Field>
                <Field label={t("vehicleForm.odometerAtPurchase")}>
                  <Input type="number" value={purchaseForm.odometer_at_purchase} onChange={(e) => updatePurchase("odometer_at_purchase", e.target.value)} />
                </Field>
              </div>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-sm text-mobile-text">
                  <input type="checkbox" checked={purchaseForm.keys_received} onChange={(e) => updatePurchase("keys_received", e.target.checked)} className="rounded border-mobile-border" />
                  {t("vehicleForm.keysReceived")}
                </label>
                <label className="flex items-center gap-2 text-sm text-mobile-text">
                  <input type="checkbox" checked={purchaseForm.documents_received} onChange={(e) => updatePurchase("documents_received", e.target.checked)} className="rounded border-mobile-border" />
                  {t("vehicleForm.docsReceived")}
                </label>
              </div>

              <Field label={t("vehicleForm.paymentProof")} hint={t("vehicleForm.paymentProofShortHint")}>
                <FileUploadGrid
                  bucket="finance-proofs"
                  pathPrefix={`purchase-payments/${uploadSessionId}`}
                  value={proofFiles}
                  onChange={setProofFiles}
                />
              </Field>
            </Card>
          </>
        )}

        <Button className="w-full" onClick={mode === "create" ? handleCreate : handleSave} loading={submitting} disabled={!isValid}>
          <Check size={16} /> {mode === "create" ? t("vehicleForm.createVehicle") : t("vehicleForm.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
