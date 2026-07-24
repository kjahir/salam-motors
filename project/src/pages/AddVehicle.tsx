import { useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { PAYMENT_METHODS, SELLER_SUBTYPES, IDENTITY_TYPES } from "@/lib/constants";
import { generateSlug } from "@/lib/calc";
import { fetchParties, checkRegistrationUnique, nextStockNumber } from "@/lib/queries";
import { VehicleFormFields, type VehicleCoreFormData } from "@/components/VehicleFormFields";
import type { Vehicle, Party } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

interface AddVehicleProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

const NEW_SELLER_VALUE = "__new__";

interface FormData extends VehicleCoreFormData {
  seller_party_id: string;
  seller_subtype: string;
  new_seller_name: string;
  new_seller_mobile: string;
  new_seller_city: string;
  new_seller_identity_type: string;
  new_seller_identity_masked: string;
  purchase_price: string;
  broker_commission: string;
  other_fee: string;
  payment_method: string;
  payment_reference: string;
  handover_location: string;
  odometer_at_purchase: string;
  keys_received: boolean;
  documents_received: boolean;
  notes: string;
}

const initialForm: FormData = {
  registration_number: "",
  category: "Motorcycle",
  manufacturer: "",
  brand: "",
  model: "",
  variant: "",
  fuel_type: "Petrol",
  colour: "",
  manufacture_year: String(new Date().getFullYear() - 2),
  registration_date: "",
  chassis_number: "",
  engine_number: "",
  odometer: "",
  owner_count: "1",
  registration_city: "",
  registration_state: "",
  current_location: "Central Yard",
  asking_price: "",
  minimum_price: "",
  seller_party_id: "",
  seller_subtype: "individual",
  new_seller_name: "",
  new_seller_mobile: "",
  new_seller_city: "",
  new_seller_identity_type: "Aadhaar",
  new_seller_identity_masked: "",
  purchase_price: "",
  broker_commission: "0",
  other_fee: "0",
  payment_method: "UPI",
  payment_reference: "",
  handover_location: "",
  odometer_at_purchase: "",
  keys_received: true,
  documents_received: false,
  notes: "",
};

export function AddVehicle({ onNavigate }: AddVehicleProps) {
  const [form, setForm] = useState<FormData>(initialForm);
  const [sellers, setSellers] = useState<Party[]>([]);
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(null);
  const [addSellerMode, setAddSellerMode] = useState(false);
  const [showMorePurchase, setShowMorePurchase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingSeller, setCreatingSeller] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchParties("seller");
        setSellers(s);
      } catch {
        toast("Failed to load reference data", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Debounced registration uniqueness check
  useEffect(() => {
    if (!form.registration_number.trim()) {
      setRegAvailable(null);
      return;
    }
    setRegChecking(true);
    const t = setTimeout(async () => {
      try {
        const ok = await checkRegistrationUnique(form.registration_number.trim());
        setRegAvailable(ok);
      } catch {
        setRegAvailable(null);
      } finally {
        setRegChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.registration_number]);

  const reloadSellers = async () => {
    try {
      const s = await fetchParties("seller");
      setSellers(s);
    } catch {
      /* ignore */
    }
  };

  const handleSellerSelect = (value: string) => {
    if (value === NEW_SELLER_VALUE) {
      setAddSellerMode(true);
      update("seller_party_id", "");
    } else {
      setAddSellerMode(false);
      update("seller_party_id", value);
    }
  };

  const handleAddSellerInline = async () => {
    if (!form.new_seller_name.trim() || !form.new_seller_mobile.trim()) {
      toast("Enter seller name and mobile", "error");
      return;
    }
    setCreatingSeller(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          party_type: "seller",
          party_subtype: form.seller_subtype,
          full_name: form.new_seller_name.trim(),
          mobile: form.new_seller_mobile.trim(),
          city: form.new_seller_city.trim() || null,
          identity_type: form.new_seller_identity_type || null,
          identity_number_masked: form.new_seller_identity_masked || null,
          consent: true,
        })
        .select()
        .single();
      if (error) throw error;
      const created = data as Party;
      setSellers((s) => [...s, created]);
      setForm((f) => ({
        ...f,
        seller_party_id: created.id,
        new_seller_name: "",
        new_seller_mobile: "",
        new_seller_city: "",
        new_seller_identity_masked: "",
      }));
      setAddSellerMode(false);
      toast("Seller added to Parties", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add seller", "error");
    } finally {
      setCreatingSeller(false);
    }
  };

  const isValid = Boolean(
    form.manufacturer.trim() &&
    form.model.trim() &&
    form.registration_number.trim() &&
    form.manufacture_year &&
    (addSellerMode ? false : form.seller_party_id) &&
    form.purchase_price && Number(form.purchase_price) > 0,
  ) && regAvailable === true;

  const handleCreate = async () => {
    if (!isValid) {
      toast("Please complete all required fields before submitting", "error");
      return;
    }
    setSubmitting(true);

    let vehicleId: string | null = null;
    let statusHistoryId: string | null = null;
    let purchaseId: string | null = null;
    let purchasePaymentId: string | null = null;
    let listingId: string | null = null;

    const rollback = async () => {
      try {
        if (listingId) await supabase.from("listings").delete().eq("id", listingId);
        if (purchasePaymentId) await supabase.from("purchase_payments").delete().eq("id", purchasePaymentId);
        if (purchaseId) await supabase.from("purchases").delete().eq("id", purchaseId);
        if (statusHistoryId) await supabase.from("vehicle_status_history").delete().eq("id", statusHistoryId);
        if (vehicleId) await supabase.from("vehicles").delete().eq("id", vehicleId);
      } catch {
        // best-effort cleanup; the original error is what gets surfaced to the user
      }
    };

    try {
      const stockNumber = await nextStockNumber();
      const year = Number(form.manufacture_year) || null;
      const sellerPartyId = form.seller_party_id;

      if (!sellerPartyId) {
        throw new Error("No seller selected");
      }

      const askingPrice = Number(form.asking_price) || 0;
      const minimumPrice = Number(form.minimum_price) || null;

      // 1. Create vehicle
      const { data: vehicle, error: vehErr } = await supabase
        .from("vehicles")
        .insert({
          stock_number: stockNumber,
          registration_number: form.registration_number.trim(),
          category: form.category,
          manufacturer: form.manufacturer,
          brand: form.brand || form.manufacturer,
          model: form.model,
          variant: form.variant || null,
          fuel_type: form.fuel_type,
          colour: form.colour || null,
          manufacture_year: year,
          registration_date: form.registration_date || null,
          chassis_number: form.chassis_number || null,
          engine_number: form.engine_number || null,
          odometer: form.odometer ? Number(form.odometer) : null,
          owner_count: Number(form.owner_count) || 1,
          registration_city: form.registration_city || null,
          registration_state: form.registration_state || null,
          current_location: form.current_location || null,
          current_status: "PURCHASED",
          asking_price: askingPrice || null,
          minimum_price: minimumPrice,
          notes: form.notes || null,
        })
        .select()
        .single();
      if (vehErr) throw vehErr;
      const v = vehicle as Vehicle;
      vehicleId = v.id;

      // 2. Status history
      const { data: history, error: histErr } = await supabase.from("vehicle_status_history").insert({
        vehicle_id: v.id,
        previous_status: "DRAFT",
        new_status: "PURCHASED",
        reason: "Vehicle onboarded",
      }).select().single();
      if (histErr) throw histErr;
      statusHistoryId = history.id;

      // 3. Purchase
      const { data: purchase, error: purErr } = await supabase
        .from("purchases")
        .insert({
          vehicle_id: v.id,
          seller_party_id: sellerPartyId,
          purchase_date: new Date().toISOString(),
          agreed_price: Number(form.purchase_price),
          broker_commission: Number(form.broker_commission) || 0,
          other_fee: Number(form.other_fee) || 0,
          payment_status: "Paid",
          handover_location: form.handover_location || null,
          odometer_at_purchase: form.odometer_at_purchase ? Number(form.odometer_at_purchase) : null,
          keys_received: form.keys_received,
          documents_received: form.documents_received,
          notes: form.notes || null,
        })
        .select()
        .single();
      if (purErr) throw purErr;
      purchaseId = purchase.id;

      // 4. Purchase payment
      const { data: purchasePayment, error: payErr } = await supabase.from("purchase_payments").insert({
        purchase_id: purchase.id,
        amount: Number(form.purchase_price) + Number(form.broker_commission || 0) + Number(form.other_fee || 0),
        payment_method: form.payment_method,
        reference: form.payment_reference || null,
        paid_at: new Date().toISOString(),
      }).select().single();
      if (payErr) throw payErr;
      purchasePaymentId = purchasePayment.id;

      // 5. Listing + passport slug — only if an asking price was given
      if (askingPrice > 0) {
        const slugBase = `${form.manufacturer}-${form.model}-${form.manufacture_year}-${form.registration_number}`.toLowerCase();
        const { data: listing, error: listErr } = await supabase.from("listings").insert({
          vehicle_id: v.id,
          asking_price: askingPrice,
          minimum_price: minimumPrice,
          status: "Draft",
          description: `${form.manufacture_year} ${form.manufacturer} ${form.model}. ${form.odometer} km.`,
          public_slug: generateSlug(slugBase) + "-" + v.id.slice(0, 6),
        }).select().single();
        if (listErr) throw listErr;
        listingId = listing.id;
      }

      // 6. Audit log
      const { error: auditErr } = await supabase.from("audit_logs").insert({
        entity_type: "vehicle",
        entity_id: v.id,
        action: "created",
        performed_by: user?.email ?? "Unknown",
        reason: `Onboarded ${stockNumber}: ${form.manufacturer} ${form.model}`,
      });
      if (auditErr) throw auditErr;

      setCreatedId(v.id);
      toast(`${stockNumber} onboarded successfully`, "success");
    } catch (e) {
      await rollback();
      toast(
        e instanceof Error
          ? `${e.message} — the vehicle was not created and any partial changes were rolled back.`
          : "Failed to create vehicle. Any partial changes were rolled back.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Onboard Vehicle" />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (createdId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Vehicle Onboarded</h2>
          <p className="text-sm text-slate-500 mt-1">
            The vehicle has been created with its purchase and seller records.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => onNavigate("vehicle", { vehicleId: createdId })} className="btn-primary">
              View Vehicle Details <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                setForm(initialForm);
                setCreatedId(null);
                reloadSellers();
              }}
              className="btn-secondary"
            >
              Onboard Another
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const selectedSeller = sellers.find((s) => s.id === form.seller_party_id);
  const sellerOptions = [
    ...sellers.map((s) => ({ value: s.id, label: `${s.full_name} — ${s.mobile ?? "no mobile"}` })),
    { value: NEW_SELLER_VALUE, label: "+ Add new seller" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader title="Onboard Vehicle" description="Capture the essentials now — the rest can be filled in later" />

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Vehicle Identity</h3>
        <VehicleFormFields form={form} update={update} regChecking={regChecking} regAvailable={regAvailable} />
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Seller</h3>
        <Field label="Select Seller" required={!addSellerMode}>
          <Select
            value={addSellerMode ? NEW_SELLER_VALUE : form.seller_party_id}
            onChange={handleSellerSelect}
            placeholder="Select seller"
            options={sellerOptions}
          />
        </Field>
        {selectedSeller && !addSellerMode && (
          <p className="text-xs text-slate-500 mt-2">{selectedSeller.full_name} · {selectedSeller.mobile ?? "No mobile"} · {selectedSeller.city ?? "No city"}</p>
        )}

        {addSellerMode && (
          <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-4 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-brand-700">New Seller Details</span>
              <button onClick={() => setAddSellerMode(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
            </div>
            <Field label="Seller Type" required>
              <div className="grid grid-cols-2 gap-3">
                {SELLER_SUBTYPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => update("seller_subtype", s.value)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      form.seller_subtype === s.value
                        ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-200"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">{s.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name" required>
                <input className="input" value={form.new_seller_name} onChange={(e) => update("new_seller_name", e.target.value)} placeholder="Ramesh Kumar" />
              </Field>
              <Field label="Mobile Number" required>
                <input className="input" value={form.new_seller_mobile} onChange={(e) => update("new_seller_mobile", e.target.value)} placeholder="9988776655" />
              </Field>
              <Field label="City">
                <input className="input" value={form.new_seller_city} onChange={(e) => update("new_seller_city", e.target.value)} placeholder="Chennai" />
              </Field>
              <Field label="Identity Type">
                <Select value={form.new_seller_identity_type} onChange={(v) => update("new_seller_identity_type", v)} options={[...IDENTITY_TYPES]} />
              </Field>
              <Field label="Identity Number (masked)" className="sm:col-span-2">
                <input className="input" value={form.new_seller_identity_masked} onChange={(e) => update("new_seller_identity_masked", e.target.value)} placeholder="XXXX-XXXX-4321" />
              </Field>
            </div>
            <button onClick={handleAddSellerInline} disabled={creatingSeller} className="btn-primary btn-sm w-full">
              {creatingSeller ? <Spinner size={14} /> : <Plus size={14} />} Add Seller to Parties
            </button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Purchase</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Purchase Price (₹)" required>
            <input className="input" type="number" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} placeholder="62000" />
          </Field>
          <Field label="Broker Commission (₹)">
            <input className="input" type="number" value={form.broker_commission} onChange={(e) => update("broker_commission", e.target.value)} />
          </Field>
        </div>

        <div className="border border-slate-200 rounded-lg mt-4">
          <button
            type="button"
            onClick={() => setShowMorePurchase((o) => !o)}
            className="flex items-center justify-between w-full p-4 text-left"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">More purchase details</p>
              <p className="text-xs text-slate-500 mt-0.5">Optional — fill in now or add later from the vehicle's detail page</p>
            </div>
            <ChevronDown size={18} className={`text-slate-400 transition-transform shrink-0 ${showMorePurchase ? "rotate-180" : ""}`} />
          </button>
          {showMorePurchase && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Other Fees (₹)">
                <input className="input" type="number" value={form.other_fee} onChange={(e) => update("other_fee", e.target.value)} />
              </Field>
              <Field label="Payment Method">
                <Select value={form.payment_method} onChange={(v) => update("payment_method", v)} options={PAYMENT_METHODS} />
              </Field>
              <Field label="Payment Reference">
                <input className="input" value={form.payment_reference} onChange={(e) => update("payment_reference", e.target.value)} placeholder="UPI/XXXX" />
              </Field>
              <Field label="Handover Location">
                <input className="input" value={form.handover_location} onChange={(e) => update("handover_location", e.target.value)} placeholder="Chennai" />
              </Field>
              <Field label="Odometer at Purchase">
                <input className="input" type="number" value={form.odometer_at_purchase} onChange={(e) => update("odometer_at_purchase", e.target.value)} />
              </Field>
              <div className="flex items-center gap-6 pt-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.keys_received} onChange={(e) => update("keys_received", e.target.checked)} className="rounded border-slate-300" />
                  Keys received
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.documents_received} onChange={(e) => update("documents_received", e.target.checked)} className="rounded border-slate-300" />
                  Documents received
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">
          <button onClick={handleCreate} disabled={submitting || !isValid} className="btn-primary">
            {submitting ? <Spinner size={16} /> : <Check size={16} />} Create Vehicle
          </button>
        </div>
      </Card>
    </div>
  );
}
