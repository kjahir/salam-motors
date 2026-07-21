import { useEffect, useState } from "react";
import {
  Bike,
  User,
  IndianRupee,
  FileText,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
} from "lucide-react";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { VEHICLE_CATEGORIES, FUEL_TYPES, PAYMENT_METHODS, VEHICLE_STATUSES, SELLER_SUBTYPES } from "@/lib/constants";
import { generateStockNumber, generateSlug } from "@/lib/calc";
import { fetchVehicles, fetchPartners, fetchParties, checkRegistrationUnique } from "@/lib/queries";
import type { Vehicle, Partner, Party } from "@/lib/types";
import type { PageKey } from "@/components/Layout";

interface AddVehicleProps {
  onNavigate: (page: PageKey, params?: { vehicleId?: string }) => void;
}

const STEPS = [
  { key: "identity", label: "Vehicle Identity", icon: <Bike size={18} /> },
  { key: "seller", label: "Seller Details", icon: <User size={18} /> },
  { key: "purchase", label: "Purchase & Investment", icon: <IndianRupee size={18} /> },
  { key: "review", label: "Review & Submit", icon: <FileText size={18} /> },
];

interface InvestmentRow {
  partner_id: string;
  amount: string;
  purpose: string;
}

interface FormData {
  // identity
  registration_number: string;
  category: string;
  manufacturer: string;
  brand: string;
  model: string;
  variant: string;
  fuel_type: string;
  colour: string;
  manufacture_year: string;
  registration_date: string;
  chassis_number: string;
  engine_number: string;
  odometer: string;
  owner_count: string;
  registration_city: string;
  registration_state: string;
  current_location: string;
  asking_price: string;
  minimum_price: string;
  // seller
  seller_party_id: string;
  seller_subtype: string;
  // new seller (when adding inline)
  new_seller_name: string;
  new_seller_mobile: string;
  new_seller_city: string;
  new_seller_identity_type: string;
  new_seller_identity_masked: string;
  // purchase
  purchase_price: string;
  broker_commission: string;
  other_fee: string;
  payment_method: string;
  payment_reference: string;
  handover_location: string;
  odometer_at_purchase: string;
  keys_received: boolean;
  documents_received: boolean;
  // multiple investments
  investments: InvestmentRow[];
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
  investments: [],
  notes: "",
};

export function AddVehicle({ onNavigate }: AddVehicleProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [existingStock, setExistingStock] = useState<string[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [sellers, setSellers] = useState<Party[]>([]);
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(null);
  const [sellerSearch, setSellerSearch] = useState("");
  const [showSellerSearch, setShowSellerSearch] = useState(false);
  const [addSellerMode, setAddSellerMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredSellers = sellers.filter((s) => {
    if (!sellerSearch.trim()) return true;
    const q = sellerSearch.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || (s.mobile ?? "").includes(q);
  });

  useEffect(() => {
    (async () => {
      try {
        const [v, p, s] = await Promise.all([fetchVehicles(), fetchPartners(), fetchParties("seller")]);
        setExistingStock(v.map((x) => x.stock_number));
        setPartners(p);
        setSellers(s);
      } catch {
        toast("Failed to load reference data", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: keyof FormData, value: string | boolean) => {
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

  const handleAddSellerInline = async () => {
    if (!form.new_seller_name.trim() || !form.new_seller_mobile.trim()) {
      toast("Enter seller name and mobile", "error");
      return;
    }
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
      setForm((f) => ({ ...f, seller_party_id: created.id }));
      setAddSellerMode(false);
      setForm((f) => ({
        ...f,
        new_seller_name: "",
        new_seller_mobile: "",
        new_seller_city: "",
        new_seller_identity_masked: "",
      }));
      toast("Seller added to Parties", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add seller", "error");
    }
  };

  // Investment row helpers
  const addInvestmentRow = () => {
    const firstPartner = partners[0]?.id ?? "";
    setForm((f) => ({
      ...f,
      investments: [...f.investments, { partner_id: firstPartner, amount: "", purpose: "Vehicle purchase" }],
    }));
  };

  const updateInvestmentRow = (idx: number, patch: Partial<InvestmentRow>) => {
    setForm((f) => ({
      ...f,
      investments: f.investments.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  const removeInvestmentRow = (idx: number) => {
    setForm((f) => ({ ...f, investments: f.investments.filter((_, i) => i !== idx) }));
  };

  const totalInvestment = form.investments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const stepValid = (): boolean => {
    if (step === 0) {
      const base = Boolean(
        form.manufacturer && form.model && form.category &&
        form.registration_number.trim() && form.asking_price && form.minimum_price,
      );
      return base && regAvailable === true;
    }
    if (step === 1) {
      if (addSellerMode) {
        return Boolean(form.new_seller_name && form.new_seller_mobile);
      }
      return Boolean(form.seller_party_id);
    }
    if (step === 2) {
      const hasPurchase = Boolean(form.purchase_price && Number(form.purchase_price) > 0);
      const hasInvestments = form.investments.length > 0 && form.investments.every((r) => r.partner_id && Number(r.amount) > 0);
      return hasPurchase && hasInvestments;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!stepValid()) {
      toast("Please complete all required fields before submitting", "error");
      return;
    }
    if (regAvailable !== true) {
      toast("Registration number is already in use or still checking", "error");
      return;
    }
    setSubmitting(true);
    try {
      const stockNumber = generateStockNumber(existingStock);
      const year = Number(form.manufacture_year) || null;
      let sellerPartyId = form.seller_party_id;

      // If inline seller was created earlier in this session, seller_party_id is set.
      // If adding a new seller at submit time (shouldn't happen since we add inline),
      // create it here.
      if (!sellerPartyId) {
        throw new Error("No seller selected");
      }

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
          asking_price: Number(form.asking_price),
          minimum_price: Number(form.minimum_price),
          notes: form.notes || null,
        })
        .select()
        .single();
      if (vehErr) throw vehErr;
      const v = vehicle as Vehicle;

      // 2. Status history
      await supabase.from("vehicle_status_history").insert({
        vehicle_id: v.id,
        previous_status: "DRAFT",
        new_status: "PURCHASED",
        reason: "Vehicle onboarded",
      });

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

      // 4. Purchase payment
      await supabase.from("purchase_payments").insert({
        purchase_id: purchase.id,
        amount: Number(form.purchase_price) + Number(form.broker_commission) + Number(form.other_fee),
        payment_method: form.payment_method,
        reference: form.payment_reference || null,
        paid_at: new Date().toISOString(),
      });

      // 5. Create multiple investments
      for (const inv of form.investments) {
        if (inv.partner_id && Number(inv.amount) > 0) {
          await supabase.from("investments").insert({
            partner_id: inv.partner_id,
            vehicle_id: v.id,
            amount: Number(inv.amount),
            investment_date: new Date().toISOString(),
            purpose: inv.purpose || "Vehicle purchase",
            payment_method: form.payment_method,
            reference: form.payment_reference || null,
            status: "Received",
          });
        }
      }

      // 6. Profit-share allocations for all partners
      for (const p of partners) {
        await supabase.from("vehicle_profit_share_allocations").upsert({
          vehicle_id: v.id,
          partner_id: p.id,
          percentage: p.default_profit_share_pct,
        });
      }

      // 7. Listing + passport slug
      const slugBase = `${form.manufacturer}-${form.model}-${form.manufacture_year}-${form.registration_number}`.toLowerCase();
      await supabase.from("listings").insert({
        vehicle_id: v.id,
        asking_price: Number(form.asking_price),
        minimum_price: Number(form.minimum_price),
        status: "Draft",
        description: `${form.manufacture_year} ${form.manufacturer} ${form.model}. ${form.odometer} km.`,
        public_slug: generateSlug(slugBase) + "-" + v.id.slice(0, 6),
      });

      // 8. Audit log
      await supabase.from("audit_logs").insert({
        entity_type: "vehicle",
        entity_id: v.id,
        action: "created",
        performed_by: "System",
        reason: `Onboarded ${stockNumber}: ${form.manufacturer} ${form.model}`,
      });

      setCreatedId(v.id);
      toast(`${stockNumber} onboarded successfully`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create vehicle", "error");
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
            The vehicle has been created with purchase, seller, investment, and profit-share records.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => onNavigate("vehicle", { vehicleId: createdId })} className="btn-primary">
              View Vehicle Details <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                setForm(initialForm);
                setCreatedId(null);
                setStep(0);
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Onboard Vehicle" description="Add a new vehicle to inventory with seller, purchase, and investment details" />

      {/* Stepper */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Check size={16} /> : s.icon}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${active ? "text-slate-900" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 rounded ${done ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-semibold text-slate-900">Vehicle Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category" required>
                <Select value={form.category} onChange={(v) => update("category", v)} options={VEHICLE_CATEGORIES} />
              </Field>
              <Field label="Fuel Type" required>
                <Select value={form.fuel_type} onChange={(v) => update("fuel_type", v)} options={FUEL_TYPES} />
              </Field>
              <Field label="Manufacturer" required>
                <input className="input" value={form.manufacturer} onChange={(e) => update("manufacturer", e.target.value)} placeholder="e.g. Honda" />
              </Field>
              <Field label="Model" required>
                <input className="input" value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="e.g. Activa 6G" />
              </Field>
              <Field label="Variant">
                <input className="input" value={form.variant} onChange={(e) => update("variant", e.target.value)} placeholder="e.g. Std" />
              </Field>
              <Field label="Brand">
                <input className="input" value={form.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Same as manufacturer usually" />
              </Field>
              <Field label="Registration Number" required hint="Primary identifier — must be unique">
                <div className="relative">
                  <input
                    className={`input pr-10 ${regAvailable === false ? "border-red-400 focus:border-red-500" : regAvailable === true ? "border-emerald-400 focus:border-emerald-500" : ""}`}
                    value={form.registration_number}
                    onChange={(e) => update("registration_number", e.target.value)}
                    placeholder="TN 22 AB 1234"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {regChecking ? (
                      <Spinner size={14} />
                    ) : regAvailable === true ? (
                      <Check size={16} className="text-emerald-500" />
                    ) : regAvailable === false ? (
                      <AlertTriangle size={16} className="text-red-500" />
                    ) : null}
                  </div>
                </div>
                {regAvailable === false && (
                  <p className="text-xs text-red-600 mt-1">This registration number is already in use.</p>
                )}
                {regAvailable === true && (
                  <p className="text-xs text-emerald-600 mt-1">Registration number is available.</p>
                )}
              </Field>
              <Field label="Colour">
                <input className="input" value={form.colour} onChange={(e) => update("colour", e.target.value)} placeholder="Black" />
              </Field>
              <Field label="Year of Manufacture" required>
                <input className="input" type="number" value={form.manufacture_year} onChange={(e) => update("manufacture_year", e.target.value)} />
              </Field>
              <Field label="Registration Date">
                <input className="input" type="date" value={form.registration_date} onChange={(e) => update("registration_date", e.target.value)} />
              </Field>
              <Field label="Chassis Number">
                <input className="input" value={form.chassis_number} onChange={(e) => update("chassis_number", e.target.value)} placeholder="MBLJEA60GNDJ01234" />
              </Field>
              <Field label="Engine Number">
                <input className="input" value={form.engine_number} onChange={(e) => update("engine_number", e.target.value)} />
              </Field>
              <Field label="Odometer (km)">
                <input className="input" type="number" value={form.odometer} onChange={(e) => update("odometer", e.target.value)} placeholder="18500" />
              </Field>
              <Field label="Previous Owners">
                <input className="input" type="number" value={form.owner_count} onChange={(e) => update("owner_count", e.target.value)} />
              </Field>
              <Field label="Registration City">
                <input className="input" value={form.registration_city} onChange={(e) => update("registration_city", e.target.value)} placeholder="Chennai" />
              </Field>
              <Field label="Registration State">
                <input className="input" value={form.registration_state} onChange={(e) => update("registration_state", e.target.value)} placeholder="Tamil Nadu" />
              </Field>
              <Field label="Current Location">
                <input className="input" value={form.current_location} onChange={(e) => update("current_location", e.target.value)} />
              </Field>
              <Field label="Asking Price (₹)" required>
                <input className="input" type="number" value={form.asking_price} onChange={(e) => update("asking_price", e.target.value)} placeholder="79000" />
              </Field>
              <Field label="Minimum Price (₹)" required>
                <input className="input" type="number" value={form.minimum_price} onChange={(e) => update("minimum_price", e.target.value)} placeholder="70000" />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-semibold text-slate-900">Seller Details</h3>
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

            {addSellerMode ? (
              <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-brand-700">Add New Seller</span>
                  <button onClick={() => setAddSellerMode(false)} className="text-xs text-slate-500 hover:text-slate-700">Select existing instead</button>
                </div>
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
                    <Select value={form.new_seller_identity_type} onChange={(v) => update("new_seller_identity_type", v)} options={["Aadhaar", "PAN", "Voter ID", "Passport", "Driving License"]} />
                  </Field>
                  <Field label="Identity Number (masked)" className="sm:col-span-2">
                    <input className="input" value={form.new_seller_identity_masked} onChange={(e) => update("new_seller_identity_masked", e.target.value)} placeholder="XXXX-XXXX-4321" />
                  </Field>
                </div>
                <button onClick={handleAddSellerInline} className="btn-primary btn-sm w-full">
                  <Plus size={14} /> Add Seller to Parties
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Select Seller from Parties" required>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      placeholder="Search sellers by name or mobile…"
                      value={sellerSearch}
                      onChange={(e) => { setSellerSearch(e.target.value); setShowSellerSearch(true); }}
                      onFocus={() => setShowSellerSearch(true)}
                    />
                  </div>
                </Field>
                {showSellerSearch && sellerSearch && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {filteredSellers.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-sm text-slate-500 mb-2">No seller found.</p>
                        <button onClick={() => { setAddSellerMode(true); setShowSellerSearch(false); setSellerSearch(""); }} className="btn-primary btn-sm">
                          <Plus size={14} /> Add "{sellerSearch}" as New Seller
                        </button>
                      </div>
                    ) : (
                      filteredSellers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setForm((f) => ({ ...f, seller_party_id: s.id, seller_subtype: (s.party_subtype ?? "individual") as string }));
                            setShowSellerSearch(false);
                            setSellerSearch("");
                          }}
                          className={`flex items-center justify-between w-full p-3 text-left hover:bg-slate-50 ${form.seller_party_id === s.id ? "bg-brand-50/50" : ""}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                            <p className="text-xs text-slate-500">{s.mobile ?? "No mobile"} · {s.city ?? "No city"}</p>
                          </div>
                          {form.seller_party_id === s.id && <Check size={16} className="text-brand-600" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selectedSeller && !sellerSearch && (
                  <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/30 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{selectedSeller.full_name}</p>
                      <p className="text-xs text-slate-500">{selectedSeller.mobile ?? "No mobile"} · {selectedSeller.city ?? "No city"}</p>
                    </div>
                    <button onClick={() => update("seller_party_id", "")} className="text-xs text-slate-500 hover:text-red-600">Change</button>
                  </div>
                )}
                <button onClick={() => setAddSellerMode(true)} className="btn-secondary btn-sm">
                  <Plus size={14} /> Add New Seller
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-semibold text-slate-900">Purchase & Investment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Purchase Price (₹)" required>
                <input className="input" type="number" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} placeholder="62000" />
              </Field>
              <Field label="Broker Commission (₹)">
                <input className="input" type="number" value={form.broker_commission} onChange={(e) => update("broker_commission", e.target.value)} />
              </Field>
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

            <div className="border-t border-slate-200 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-slate-800">Investing Partners <span className="text-red-500">*</span></h4>
                <button onClick={addInvestmentRow} className="btn-secondary btn-sm"><Plus size={14} /> Add Partner</button>
              </div>
              {form.investments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm text-slate-500 mb-3">At least one investing partner is required.</p>
                  <button onClick={addInvestmentRow} className="btn-primary btn-sm"><Plus size={14} /> Add Investment</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.investments.map((inv, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end rounded-lg border border-slate-200 p-3">
                      <Field label="Partner" required className="sm:col-span-5">
                        <Select
                          value={inv.partner_id}
                          onChange={(v) => updateInvestmentRow(idx, { partner_id: v })}
                          placeholder="Select partner"
                          options={partners.map((p) => ({ value: p.id, label: p.name }))}
                        />
                      </Field>
                      <Field label="Amount (₹)" required className="sm:col-span-4">
                        <input className="input" type="number" value={inv.amount} onChange={(e) => updateInvestmentRow(idx, { amount: e.target.value })} placeholder="31000" />
                      </Field>
                      <Field label="Purpose" className="sm:col-span-2">
                        <input className="input" value={inv.purpose} onChange={(e) => updateInvestmentRow(idx, { purpose: e.target.value })} />
                      </Field>
                      <div className="sm:col-span-1 flex justify-end">
                        <button onClick={() => removeInvestmentRow(idx)} className="btn-ghost btn-sm text-red-500 hover:text-red-700" title="Remove">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-slate-500">Total Investment</span>
                    <span className="text-sm font-bold text-slate-900">₹{totalInvestment.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-semibold text-slate-900">Review & Submit</h3>
            <ReviewRow label="Stock Number" value={generateStockNumber(existingStock)} />
            <ReviewRow label="Vehicle" value={`${form.manufacturer} ${form.model} ${form.variant ?? ""} (${form.manufacture_year})`} />
            <ReviewRow label="Registration" value={form.registration_number} />
            <ReviewRow label="Category" value={form.category} />
            <ReviewRow label="Fuel" value={form.fuel_type} />
            <ReviewRow label="Seller" value={selectedSeller ? `${selectedSeller.full_name} · ${selectedSeller.mobile ?? "—"}` : "—"} />
            <ReviewRow label="Asking Price" value={`₹${Number(form.asking_price || 0).toLocaleString("en-IN")}`} />
            <ReviewRow label="Minimum Price" value={`₹${Number(form.minimum_price || 0).toLocaleString("en-IN")}`} />
            <ReviewRow label="Purchase Price" value={`₹${Number(form.purchase_price || 0).toLocaleString("en-IN")}`} />
            <ReviewRow
              label="Total Purchase Cost"
              value={`₹${(Number(form.purchase_price || 0) + Number(form.broker_commission || 0) + Number(form.other_fee || 0)).toLocaleString("en-IN")}`}
            />
            <ReviewRow label="Investments" value={`${form.investments.length} partner(s) · ₹${totalInvestment.toLocaleString("en-IN")}`} />
            <ReviewRow label="Initial Status" value="PURCHASED" />

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5 mt-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                On submission, the system will create the vehicle, purchase transaction, payment record,
                investment entries for each partner, and default profit-share allocations for all partners.
                A draft listing and passport will also be generated.
              </p>
            </div>

            <Field label="Notes">
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Any additional notes about this vehicle" />
            </Field>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
            className="btn-secondary"
          >
            <ChevronLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!stepValid()} className="btn-primary">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={submitting} className="btn-primary">
              {submitting ? <Spinner size={16} /> : <Check size={16} />} Create Vehicle
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}
