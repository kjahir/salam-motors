import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizeClass} bg-white rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm -mt-1 -mr-1">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}
