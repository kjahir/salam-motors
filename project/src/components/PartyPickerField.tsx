import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Field, Select, Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { supabase } from "@/lib/supabase";
import { fetchParties } from "@/lib/queries";
import { SELLER_SUBTYPES, BUYER_SUBTYPES, IDENTITY_TYPES } from "@/lib/constants";
import type { Party } from "@/lib/types";

const NEW_VALUE = "__new__";

interface PartyPickerFieldProps {
  partyType: "seller" | "buyer";
  value: string;
  onChange: (partyId: string) => void;
  label?: string;
}

/**
 * Search-existing-or-add-new picker for a party (seller/buyer) FK field. Shared by the
 * desktop Add Vehicle form and Sale tab, and by the mobile Add/Edit form — parties are
 * a real table (seller_party_id/buyer_party_id FKs), so free-text names aren't valid here.
 */
export function PartyPickerField({ partyType, value, onChange, label }: PartyPickerFieldProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    subtype: partyType === "seller" ? SELLER_SUBTYPES[0].value : BUYER_SUBTYPES[0].value,
    full_name: "",
    mobile: "",
    city: "",
    identity_type: IDENTITY_TYPES[0],
    identity_masked: "",
  });
  const { toast } = useToast();

  const subtypes = partyType === "seller" ? SELLER_SUBTYPES : BUYER_SUBTYPES;

  const load = async () => {
    try {
      const list = await fetchParties(partyType);
      setParties(list);
    } catch {
      toast(`Failed to load ${partyType}s`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType]);

  const handleSelect = (v: string) => {
    if (v === NEW_VALUE) {
      setAddMode(true);
      onChange("");
    } else {
      setAddMode(false);
      onChange(v);
    }
  };

  const handleAdd = async () => {
    if (!form.full_name.trim() || !form.mobile.trim()) {
      toast(`Enter ${partyType} name and mobile`, "error");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          party_type: partyType,
          party_subtype: form.subtype,
          full_name: form.full_name.trim(),
          mobile: form.mobile.trim(),
          city: form.city.trim() || null,
          identity_type: partyType === "seller" ? form.identity_type || null : null,
          identity_number_masked: partyType === "seller" ? form.identity_masked || null : null,
          consent: true,
        })
        .select()
        .single();
      if (error) throw error;
      const created = data as Party;
      setParties((p) => [...p, created]);
      onChange(created.id);
      setAddMode(false);
      setForm((f) => ({ ...f, full_name: "", mobile: "", city: "", identity_masked: "" }));
      toast(`${partyType === "seller" ? "Seller" : "Buyer"} added`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : `Failed to add ${partyType}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const selected = parties.find((p) => p.id === value);
  const options = [
    ...parties.map((p) => ({ value: p.id, label: `${p.full_name} — ${p.mobile ?? "no mobile"}` })),
    { value: NEW_VALUE, label: `+ Add new ${partyType}` },
  ];

  if (loading) return <Spinner size={16} />;

  return (
    <div>
      <Field label={label ?? (partyType === "seller" ? "Select Seller" : "Select Buyer")} required={!addMode}>
        <Select value={addMode ? NEW_VALUE : value} onChange={handleSelect} placeholder={`Select ${partyType}`} options={options} />
      </Field>
      {selected && !addMode && (
        <p className="text-xs text-slate-500 mt-2">
          {selected.full_name} · {selected.mobile ?? "No mobile"} · {selected.city ?? "No city"}
        </p>
      )}

      {addMode && (
        <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-4 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-brand-700">New {partyType === "seller" ? "Seller" : "Buyer"} Details</span>
            <button onClick={() => setAddMode(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
          <Field label={`${partyType === "seller" ? "Seller" : "Buyer"} Type`} required>
            <div className="grid grid-cols-2 gap-3">
              {subtypes.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, subtype: s.value }))}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    form.subtype === s.value ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-200" : "border-slate-200 hover:border-slate-300"
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
              <input className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Ramesh Kumar" />
            </Field>
            <Field label="Mobile Number" required>
              <input className="input" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="9988776655" />
            </Field>
            <Field label="City">
              <input className="input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Chennai" />
            </Field>
            {partyType === "seller" && (
              <>
                <Field label="Identity Type">
                  <Select value={form.identity_type} onChange={(v) => setForm((f) => ({ ...f, identity_type: v }))} options={[...IDENTITY_TYPES]} />
                </Field>
                <Field label="Identity Number (masked)" className="sm:col-span-2">
                  <input className="input" value={form.identity_masked} onChange={(e) => setForm((f) => ({ ...f, identity_masked: e.target.value }))} placeholder="XXXX-XXXX-4321" />
                </Field>
              </>
            )}
          </div>
          <button onClick={handleAdd} disabled={creating} className="btn-primary btn-sm w-full">
            {creating ? <Spinner size={14} /> : <Plus size={14} />} Add {partyType === "seller" ? "Seller" : "Buyer"} to Parties
          </button>
        </div>
      )}
    </div>
  );
}
