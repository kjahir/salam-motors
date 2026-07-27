import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCircle, Plus, Search, Store, Building2, User, Briefcase, Trash2, Pencil, Bike, X, Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, Field, Select, Spinner } from "@/components/ui/Primitives";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { formatDate, initials } from "@/lib/format";
import { fetchParties, fetchPartyVehicles } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import {
  SELLER_SUBTYPES, BUYER_SUBTYPES, MECHANIC_SUBTYPES, PARTY_SUBTYPE_LABELS, IDENTITY_TYPES, INDIAN_STATES,
} from "@/lib/constants";
import type { Party, PartySubtype, Vehicle } from "@/lib/types";
import type { PageKey, NavigateParams } from "@/components/Layout";

interface PartiesProps {
  onNavigate: (page: PageKey, params?: NavigateParams) => void;
}

type RoleFilter = "all" | "seller" | "buyer" | "mechanic";

interface PartyFormState {
  party_type: "seller" | "buyer" | "mechanic";
  party_subtype: PartySubtype;
  full_name: string;
  mobile: string;
  alternate_mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  identity_type: string;
  identity_number_masked: string;
  notes: string;
  consent: boolean;
}

const emptyForm: PartyFormState = {
  party_type: "seller",
  party_subtype: "individual",
  full_name: "",
  mobile: "",
  alternate_mobile: "",
  email: "",
  address: "",
  city: "",
  state: "Tamil Nadu",
  postal_code: "",
  identity_type: "Aadhaar",
  identity_number_masked: "",
  notes: "",
  consent: true,
};

const subtypeMeta: Record<PartySubtype, { icon: typeof User; label: string; color: "blue" | "amber" | "brand" | "slate" }> = {
  individual: { icon: User, label: "Individual", color: "blue" },
  bank_auction: { icon: Building2, label: "Bank Auction", color: "amber" },
  agent: { icon: Briefcase, label: "Agent", color: "brand" },
  company_mechanic: { icon: Wrench, label: "Company Mechanic", color: "slate" },
};

export function Parties({ onNavigate }: PartiesProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartyFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [detailParty, setDetailParty] = useState<Party | null>(null);
  const [partyVehicles, setPartyVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const partyRoleLabel = (role: string) => role === "seller" ? t("partiesPage.seller") : role === "buyer" ? t("partiesPage.buyer") : t("partiesPage.mechanic");
  const subtypeLabel = (subtype: string) => t("partiesPage.subtypes." + subtype, { defaultValue: PARTY_SUBTYPE_LABELS[subtype as PartySubtype] ?? subtype });

  const reload = useCallback(async () => {
    try {
      const p = await fetchParties();
      setParties(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("partiesPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    return parties.filter((p) => {
      if (roleFilter !== "all" && p.party_type !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          (p.mobile ?? "").includes(q) ||
          (p.city ?? "").toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [parties, roleFilter, search]);

  const sellers = parties.filter((p) => p.party_type === "seller");
  const buyers = parties.filter((p) => p.party_type === "buyer");
  const mechanics = parties.filter((p) => p.party_type === "mechanic");
  const individualSellers = sellers.filter((p) => p.party_subtype === "individual").length;
  const bankSellers = sellers.filter((p) => p.party_subtype === "bank_auction").length;
  const agentBuyers = buyers.filter((p) => p.party_subtype === "agent").length;

  const openDetail = async (party: Party) => {
    setDetailParty(party);
    setPartyVehicles([]);
    setVehiclesLoading(true);
    try {
      const v = await fetchPartyVehicles(party.id, party.party_type);
      setPartyVehicles(v);
    } catch {
      toast(t("partiesPage.relatedLoadFailed"), "error");
    } finally {
      setVehiclesLoading(false);
    }
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (party: Party) => {
    setForm({
      party_type: party.party_type as "seller" | "buyer" | "mechanic",
      party_subtype: (party.party_subtype ?? "individual") as PartySubtype,
      full_name: party.full_name,
      mobile: party.mobile ?? "",
      alternate_mobile: party.alternate_mobile ?? "",
      email: party.email ?? "",
      address: party.address ?? "",
      city: party.city ?? "",
      state: party.state ?? "",
      postal_code: party.postal_code ?? "",
      identity_type: party.identity_type ?? "Aadhaar",
      identity_number_masked: party.identity_number_masked ?? "",
      notes: party.notes ?? "",
      consent: party.consent,
    });
    setEditingId(party.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast(t("partiesPage.enterFullName"), "error");
      return;
    }
    if (!form.mobile.trim()) {
      toast(t("partiesPage.enterMobile"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        party_type: form.party_type,
        party_subtype: form.party_subtype,
        full_name: form.full_name.trim(),
        mobile: form.mobile.trim() || null,
        alternate_mobile: form.alternate_mobile.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state || null,
        postal_code: form.postal_code.trim() || null,
        identity_type: form.identity_type || null,
        identity_number_masked: form.identity_number_masked.trim() || null,
        notes: form.notes.trim() || null,
        consent: form.consent,
      };
      if (editingId) {
        const { error } = await supabase.from("parties").update(payload).eq("id", editingId);
        if (error) throw error;
        toast(t("partiesPage.partyUpdated"), "success");
      } else {
        const { error } = await supabase.from("parties").insert(payload);
        if (error) throw error;
        toast(t("partiesPage.partyAdded"), "success");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("partiesPage.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (party: Party) => {
    if (partyVehicles.length > 0) {
      toast(
        t("partiesPage.linkedDeleteBlocked", { name: party.full_name, count: partyVehicles.length }),
        "error",
      );
      return;
    }
    if (!confirm(t("partiesPage.deleteConfirm", { name: party.full_name }))) return;
    try {
      const { error } = await supabase
        .from("parties")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", party.id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({
          entity_type: "party",
          entity_id: party.id,
          action: "deleted",
          performed_by: user?.email ?? "Unknown",
          reason: t("partiesPage.deletedReason", { name: party.full_name }),
        })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log party deletion", auditErr);
        });
      toast(t("partiesPage.partyRemoved"), "success");
      setDetailParty(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("partiesPage.deleteFailed"), "error");
    }
  };

  const update = (key: keyof PartyFormState, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const onTypeChange = (type: string) => {
    const newType = type as "seller" | "buyer" | "mechanic";
    const firstSub = newType === "seller" ? SELLER_SUBTYPES[0].value : newType === "buyer" ? BUYER_SUBTYPES[0].value : MECHANIC_SUBTYPES[0].value;
    setForm((f) => ({ ...f, party_type: newType, party_subtype: firstSub }));
  };

  const subtypeOptions = form.party_type === "seller" ? SELLER_SUBTYPES : form.party_type === "buyer" ? BUYER_SUBTYPES : MECHANIC_SUBTYPES;

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t("partiesPage.title")} />
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={t("partiesPage.title")} />
        <Card className="p-6"><EmptyState title={t("partiesPage.failedToLoadShort")} description={error} /></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("partiesPage.title")}
        description={t("partiesPage.description")}
        icon={<UserCircle size={20} />}
        actions={<button onClick={openAdd} className="btn-primary"><Plus size={16} /> {t("partiesPage.addParty")}</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={t("partiesPage.totalParties")} value={parties.length} icon={<UserCircle size={20} />} color="brand" />
        <StatCard label={t("partiesPage.sellers")} value={sellers.length} hint={t("partiesPage.individualBank", { individual: individualSellers, bank: bankSellers })} icon={<Store size={20} />} color="slate" />
        <StatCard label={t("partiesPage.buyers")} value={buyers.length} hint={t("partiesPage.individualAgent", { individual: buyers.length - agentBuyers, agent: agentBuyers })} icon={<User size={20} />} color="emerald" />
        <StatCard label={t("partiesPage.mechanics")} value={mechanics.length} icon={<Wrench size={20} />} color="amber" />
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder={t("partiesPage.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(["all", "seller", "buyer", "mechanic"] as RoleFilter[]).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  roleFilter === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r === "all" ? t("partiesPage.all") : r === "seller" ? t("partiesPage.sellers") : r === "buyer" ? t("partiesPage.buyers") : t("partiesPage.mechanics")}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<UserCircle size={24} />}
            title={search ? t("partiesPage.noMatch") : t("partiesPage.noParties")}
            description={search ? t("partiesPage.tryDifferent") : t("partiesPage.emptyDescription")}
            action={!search && <button onClick={openAdd} className="btn-primary"><Plus size={16} /> {t("partiesPage.addParty")}</button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const sub = p.party_subtype ? subtypeMeta[p.party_subtype] : null;
            const SubIcon = sub?.icon ?? User;
            return (
              <Card key={p.id} className="p-4" hover onClick={() => openDetail(p)}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-sm ${
                    p.party_type === "seller" ? "bg-blue-50 text-blue-700" : p.party_type === "buyer" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {initials(p.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 truncate">{p.full_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{p.mobile ?? t("partiesPage.noMobile")}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge color={p.party_type === "seller" ? "blue" : p.party_type === "buyer" ? "emerald" : "amber"}>
                        {partyRoleLabel(p.party_type)}
                      </Badge>
                      {sub && (
                        <Badge color={sub.color}>
                          <SubIcon size={11} className="mr-1" />
                          {subtypeLabel(p.party_subtype as PartySubtype)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {(p.city || p.state) && (
                  <p className="text-xs text-slate-400 mt-3">{[p.city, p.state].filter(Boolean).join(", ")}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      {detailParty && (
        <div className="fixed inset-0 z-40 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetailParty(null)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full font-semibold ${
                  detailParty.party_type === "seller" ? "bg-blue-50 text-blue-700" : detailParty.party_type === "buyer" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {initials(detailParty.full_name)}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{detailParty.full_name}</h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge color={detailParty.party_type === "seller" ? "blue" : detailParty.party_type === "buyer" ? "emerald" : "amber"}>
                      {partyRoleLabel(detailParty.party_type)}
                    </Badge>
                    {detailParty.party_subtype && (
                      <Badge color={subtypeMeta[detailParty.party_subtype as PartySubtype].color}>
                        {subtypeLabel(detailParty.party_subtype as PartySubtype)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailParty(null)} className="btn-ghost btn-sm"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3"> {t("partiesPage.contact")}</h3>
                <div className="space-y-2.5 text-sm">
                  <DetailRow label={t("partiesPage.mobile")} value={detailParty.mobile} />
                  <DetailRow label={t("partiesPage.altMobile")} value={detailParty.alternate_mobile} />
                  <DetailRow label={t("partiesPage.email")} value={detailParty.email} />
                  <DetailRow label={t("partiesPage.address")} value={[detailParty.address, detailParty.city, detailParty.state, detailParty.postal_code].filter(Boolean).join(", ") || null} />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3"> {t("partiesPage.identity")}</h3>
                <div className="space-y-2.5 text-sm">
                  <DetailRow label={t("partiesPage.type")} value={detailParty.identity_type} />
                  <DetailRow label={t("partiesPage.numberMasked")} value={detailParty.identity_number_masked} />
                  <DetailRow label={t("partiesPage.consent")} value={detailParty.consent ? t("partiesPage.yes") : t("partiesPage.no")} />
                </div>
              </div>

              {detailParty.notes && (
                <div>
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2"> {t("partiesPage.notes")}</h3>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{detailParty.notes}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                  {t("partiesPage.relatedVehicles", { count: vehiclesLoading ? "…" : partyVehicles.length })}
                </h3>
                {vehiclesLoading ? (
                  <div className="flex justify-center py-4"><Spinner size={20} /></div>
                ) : partyVehicles.length === 0 ? (
                  <p className="text-sm text-slate-400"> {t("partiesPage.noVehiclesLinked")}</p>
                ) : (
                  <div className="space-y-2">
                    {partyVehicles.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setDetailParty(null);
                          onNavigate("vehicle", { vehicleId: v.id });
                        }}
                        className="flex items-center gap-3 w-full p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 text-left transition-colors"
                      >
                        <Bike size={18} className="text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{v.manufacturer} {v.model}</p>
                          <p className="text-xs text-slate-500">{v.stock_number} · {v.current_status.replace(/_/g, " ")}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 pt-2">{t("partiesPage.added", { date: formatDate(detailParty.created_at) })}</p>

              <div className="flex gap-2 pt-3 border-t border-slate-200">
                <button onClick={() => { openEdit(detailParty); setDetailParty(null); }} className="btn-secondary flex-1">
                  <Pencil size={15} /> {t("partiesPage.edit")}
                </button>
                <button
                  onClick={() => handleDelete(detailParty)}
                  disabled={vehiclesLoading}
                  className="btn-secondary text-red-600 hover:bg-red-50 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={15} /> {t("partiesPage.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingId(null); }}
        title={editingId ? t("partiesPage.editParty") : t("partiesPage.addParty")}
        description={editingId ? t("partiesPage.updateDetails") : t("partiesPage.addDescription")}
        size="lg"
        footer={<>
          <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary"> {t("partiesPage.cancel")}</button>
          <button onClick={handleSave} disabled={submitting} className="btn-primary">
            {submitting ? <Spinner size={14} /> : null} {editingId ? t("partiesPage.saveChanges") : t("partiesPage.addParty")}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("partiesPage.role")} required>
              <Select
                value={form.party_type}
                onChange={onTypeChange}
                options={[{ value: "seller", label: t("partiesPage.seller") }, { value: "buyer", label: t("partiesPage.buyer") }, { value: "mechanic", label: t("partiesPage.mechanic") }]}
              />
            </Field>
            <Field label={t("partiesPage.subType")} required>
              <Select
                value={form.party_subtype}
                onChange={(v) => update("party_subtype", v)}
                options={subtypeOptions.map((s) => ({ value: s.value, label: subtypeLabel(s.value) }))}
              />
            </Field>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            {subtypeOptions.find((s) => s.value === form.party_subtype)?.description}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("partiesPage.fullName")} required>
              <input className="input" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Ramesh Kumar" />
            </Field>
            <Field label={t("partiesPage.mobileNumber")} required>
              <input className="input" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} placeholder="9988776655" />
            </Field>
            <Field label={t("partiesPage.alternateMobile")}>
              <input className="input" value={form.alternate_mobile} onChange={(e) => update("alternate_mobile", e.target.value)} placeholder={t("partiesPage.optional")} />
            </Field>
            <Field label={t("partiesPage.email")}>
              <input className="input" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="name@example.com" />
            </Field>
          </div>

          <Field label={t("partiesPage.address")}>
            <input className="input" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder={t("partiesPage.streetAddress")} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={t("partiesPage.city")}>
              <input className="input" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Chennai" />
            </Field>
            <Field label={t("partiesPage.state")}>
              <Select value={form.state} onChange={(v) => update("state", v)} options={["", ...INDIAN_STATES]} />
            </Field>
            <Field label={t("partiesPage.postalCode")}>
              <input className="input" value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} placeholder="600001" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("partiesPage.identityType")}>
              <Select value={form.identity_type} onChange={(v) => update("identity_type", v)} options={[...IDENTITY_TYPES]} />
            </Field>
            <Field label={t("partiesPage.identityMasked")} hint={t("partiesPage.privacyHint")}>
              <input className="input" value={form.identity_number_masked} onChange={(e) => update("identity_number_masked", e.target.value)} placeholder="XXXX-XXXX-4321" />
            </Field>
          </div>

          <Field label={t("partiesPage.notes")}>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder={t("partiesPage.additionalNotes")} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} className="rounded border-slate-300" />
            {t("partiesPage.consentText")}
          </label>
        </div>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 font-medium text-right">{value || "—"}</span>
    </div>
  );
}
