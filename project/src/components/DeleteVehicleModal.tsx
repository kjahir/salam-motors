import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

interface DeleteVehicleModalProps {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

const BLOCKED_STATUSES = ["SOLD", "DELIVERED"];

export function DeleteVehicleModal({ vehicle, open, onClose, onDeleted }: DeleteVehicleModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  const blocked = BLOCKED_STATUSES.includes(vehicle.current_status);
  const canDelete = !blocked && confirmText.trim() === vehicle.stock_number;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", vehicle.id);
      if (error) throw error;
      supabase
        .from("audit_logs")
        .insert({
          entity_type: "vehicle",
          entity_id: vehicle.id,
          action: "deleted",
          performed_by: user?.email ?? t("auth.user"),
          reason: t("deleteVehicle.reason", { stock: vehicle.stock_number, vehicle: `${vehicle.manufacturer} ${vehicle.model}` }),
        })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log vehicle deletion", auditErr);
        });
      toast(t("deleteVehicle.deleted", { stock: vehicle.stock_number }), "success");
      onDeleted();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("deleteVehicle.failed"), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("deleteVehicle.title", { stock: vehicle.stock_number })}
      footer={
        blocked ? (
          <button onClick={onClose} className="btn-secondary">{t("deleteVehicle.close")}</button>
        ) : (
          <>
            <button onClick={onClose} className="btn-secondary">{t("deleteVehicle.cancel")}</button>
            <button onClick={handleDelete} disabled={!canDelete || deleting} className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {deleting ? <Spinner size={14} /> : null} {t("deleteVehicle.deletePermanently")}
            </button>
          </>
        )
      }
    >
      {blocked ? (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">{t("deleteVehicle.blockedMessage", { stock: vehicle.stock_number, status: t("status." + vehicle.current_status, { defaultValue: vehicle.current_status }) })}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{t("deleteVehicle.warning")}</p>
          </div>
          <div>
            <label className="label">
              <Trans i18nKey="deleteVehicle.confirmLabel" values={{ stock: vehicle.stock_number }} components={{ stock: <span className="font-mono font-semibold" /> }} />
            </label>
            <input
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={vehicle.stock_number}
              autoFocus
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
