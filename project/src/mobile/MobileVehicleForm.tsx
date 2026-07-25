import { useEffect, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { TopBar, Field, Input, Select, Button, Spinner, Card } from "./ui/primitives";
import { PartyPickerField } from "@/components/PartyPickerField";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { checkRegistrationUnique, fetchVehicle } from "@/lib/queries";
import { createVehicle } from "@/lib/vehicle";
import { generateSlug } from "@/lib/calc";
import { VEHICLE_CATEGORIES, FUEL_TYPES } from "@/lib/constants";
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

interface MobileVehicleFormProps {
  mode: "create" | "edit";
  vehicleId?: string;
  onNavigate: MobileNavigate;
  onBack: () => void;
}

export function MobileVehicleForm({ mode, vehicleId, onNavigate, onBack }: MobileVehicleFormProps) {
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

  const update = <K extends keyof CoreForm>(key: K, value: CoreForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (mode !== "edit" || !vehicleId) return;
    let cancelled = false;
    (async () => {
      const v = await fetchVehicle(vehicleId);
      if (cancelled || !v) return;
      setVehicle(v);
      setForm({
        registration_number: v.registration_number ?? "",
        category: v.category,
        manufacturer: v.manufacturer,
        model: v.model,
        fuel_type: v.fuel_type,
        colour: v.colour ?? "",
        manufacture_year: v.manufacture_year ? String(v.manufacture_year) : "",
        odometer: v.odometer !== null ? String(v.odometer) : "",
        asking_price: v.asking_price !== null ? String(v.asking_price) : "",
        minimum_price: v.minimum_price !== null ? String(v.minimum_price) : "",
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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
      toast(`${v.stock_number} onboarded successfully`, "success");
      onNavigate("vehicle", { vehicleId: v.id });
    } catch (e) {
      toast(e instanceof Error ? `${e.message} — rolled back.` : "Failed to create vehicle", "error");
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
        registration_number: form.registration_number.trim(),
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

      toast("Vehicle updated", "success");
      onNavigate("vehicle", { vehicleId });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update vehicle", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <TopBar title={mode === "create" ? "Onboard Vehicle" : "Edit Vehicle"} onBack={onBack} />
        <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={mode === "create" ? "Onboard Vehicle" : `Edit ${vehicle?.stock_number ?? ""}`} onBack={onBack} />
      <div className="p-4 space-y-4 pb-28">
        <Card className="p-4 space-y-4">
          <Field label="Category" required>
            <Select value={form.category} onChange={(v) => update("category", v)} options={VEHICLE_CATEGORIES} />
          </Field>
          <Field label="Fuel Type" required>
            <Select value={form.fuel_type} onChange={(v) => update("fuel_type", v)} options={FUEL_TYPES} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Manufacturer" required>
              <Input value={form.manufacturer} onChange={(e) => update("manufacturer", e.target.value)} placeholder="Honda" />
            </Field>
            <Field label="Model" required>
              <Input value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="Activa 6G" />
            </Field>
          </div>
          <Field label="Registration Number" required hint={regAvailable === false ? undefined : "Must be unique"}>
            <div className="relative">
              <Input
                value={form.registration_number}
                onChange={(e) => update("registration_number", e.target.value)}
                placeholder="TN 22 AB 1234"
                className={regAvailable === false ? "border-mobile-error" : regAvailable === true ? "border-mobile-success" : ""}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {regChecking ? <Spinner size={14} /> : regAvailable === true ? <Check size={16} className="text-mobile-success" /> : regAvailable === false ? <AlertTriangle size={16} className="text-mobile-error" /> : null}
              </div>
            </div>
            {regAvailable === false && <p className="text-xs text-mobile-error mt-1">Already in use.</p>}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" required>
              <Input type="number" value={form.manufacture_year} onChange={(e) => update("manufacture_year", e.target.value)} />
            </Field>
            <Field label="Colour">
              <Input value={form.colour} onChange={(e) => update("colour", e.target.value)} placeholder="Black" />
            </Field>
          </div>
          <Field label="Odometer (km)">
            <Input type="number" value={form.odometer} onChange={(e) => update("odometer", e.target.value)} placeholder="18500" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asking Price (₹)">
              <Input type="number" value={form.asking_price} onChange={(e) => update("asking_price", e.target.value)} placeholder="79000" />
            </Field>
            <Field label="Minimum Price (₹)">
              <Input type="number" value={form.minimum_price} onChange={(e) => update("minimum_price", e.target.value)} placeholder="70000" />
            </Field>
          </div>
        </Card>

        {mode === "create" && (
          <>
            <Card className="p-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">Seller</h3>
              <PartyPickerField partyType="seller" value={sellerPartyId} onChange={setSellerPartyId} />
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-poppins font-semibold text-mobile-text mb-3">Purchase</h3>
              <Field label="Purchase Price (₹)" required>
                <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="62000" />
              </Field>
            </Card>
          </>
        )}

        <Button className="w-full" onClick={mode === "create" ? handleCreate : handleSave} loading={submitting} disabled={!isValid}>
          <Check size={16} /> {mode === "create" ? "Create Vehicle" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
