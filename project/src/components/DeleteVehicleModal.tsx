import { useState } from "react";
import { AlertTriangle } from "lucide-react";
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
          performed_by: user?.email ?? "Unknown",
          reason: `Deleted ${vehicle.stock_number}: ${vehicle.manufacturer} ${vehicle.model}`,
        })
        .then(({ error: auditErr }) => {
          if (auditErr) console.error("Failed to log vehicle deletion", auditErr);
        });
      toast(`${vehicle.stock_number} deleted`, "success");
      onDeleted();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete vehicle", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Delete ${vehicle.stock_number}`}
      footer={
        blocked ? (
          <button onClick={onClose} className="btn-secondary">Close</button>
        ) : (
          <>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={!canDelete || deleting} className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {deleting ? <Spinner size={14} /> : null} Delete Permanently
            </button>
          </>
        )
      }
    >
      {blocked ? (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            {vehicle.stock_number} is marked <strong>{vehicle.current_status}</strong> and has completed sale records.
            It can't be deleted — this preserves the sale, profit-distribution, and financial history.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">
              This permanently deletes the vehicle and everything linked to it — purchase, expenses, investments,
              inspections, documents, listing, and status history. This cannot be undone.
            </p>
          </div>
          <div>
            <label className="label">
              Type <span className="font-mono font-semibold">{vehicle.stock_number}</span> to confirm
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
