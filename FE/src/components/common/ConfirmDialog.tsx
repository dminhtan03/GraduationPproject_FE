import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  tone = "default",
  onConfirm,
  onClose,
}) => {
  if (!open) return null;

  const isDanger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => {
          if (!loading) onClose();
        }}
        className="absolute inset-0 h-full w-full"
        aria-label="Close confirm dialog"
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div
          className={`flex items-start gap-3 px-5 py-4 ${
            isDanger
              ? "bg-gradient-to-r from-rose-500 to-red-500 text-white"
              : "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
          }`}
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-white/90">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            disabled={loading}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDanger
                ? "bg-rose-500 hover:bg-rose-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
