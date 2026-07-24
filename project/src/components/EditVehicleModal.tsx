import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { checkRegistrationUnique } from "@/lib/queries";
import { generateSlug } from "@/lib/calc";
import { VehicleFormFields, type VehicleCoreFormData } from "@/components/VehicleFormFields";
import type { Vehicle } from "@/lib/types";

interface EditVehicleModalProps {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
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

export function EditVehicleModal({ vehicle, open, onClose, onSaved }: EditVehicleModalProps) {
  const [form, setForm] = useState<VehicleCoreFormData>(() => toFormData(vehicle));
  const [regChecking, setRegChecking] = useState(false);
  const [regAvailable, setRegAvailable] = useState<boolean | null>(true);
  const [listingId, setListingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setForm(toFormData(vehicle));
    setRegAvailable(true);
    (async () => {
      const { data } = await supabase.from("listings").select("id").eq("vehicle_id", vehicle.id).maybeSingle();
      setListingId(data?.id ?? null);
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
      <VehicleFormFields form={form} update={update} regChecking={regChecking} regAvailable={regAvailable} defaultShowMore />
    </Modal>
  );
}
