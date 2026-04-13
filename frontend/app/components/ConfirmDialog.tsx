/**
 * ConfirmDialog — inline modal for confirming destructive or significant actions.
 * Uses brand tokens from DESIGN.md. Confirm button can be styled as destructive (error)
 * or primary (accent) via the variant prop.
 */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: "primary" | "destructive";
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  variant = "primary",
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClasses =
    variant === "destructive"
      ? "rounded-full bg-status-error px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      : "rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-brand-surface p-6 shadow-xl">
        <h3 className="font-display text-lg font-bold text-brand-text mb-2">{title}</h3>
        <p className="text-sm text-brand-muted mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand-muted hover:bg-brand-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={confirmClasses}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
