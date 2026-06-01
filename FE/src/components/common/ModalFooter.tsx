import React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

export interface ModalFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  cancelText?: string;
  submitText: string;
  helperText?: string;
  isSubmitting?: boolean;
  canSubmit?: boolean;
  primaryButtonClassName?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  onCancel,
  onSubmit,
  cancelText = "Cancel",
  submitText,
  helperText,
  isSubmitting = false,
  canSubmit = true,
  primaryButtonClassName = "bg-orange-500 hover:bg-orange-600 focus:ring-orange-500/20 active:bg-orange-700",
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/50 mt-4 -mx-6 -mb-5 shrink-0">
      {helperText ? (
        <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-xs sm:max-w-[320px]">
          {helperText}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-50 shadow-sm"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          className={`inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 shadow-sm disabled:cursor-not-allowed focus:outline-none focus:ring-4 ${
            canSubmit && !isSubmitting
              ? `${primaryButtonClassName} active:scale-[0.98]`
              : "bg-slate-200 text-slate-400"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <ArrowPathIcon className="h-4 w-4 animate-spin text-white" />
              Processing...
            </span>
          ) : (
            submitText
          )}
        </button>
      </div>
    </div>
  );
};

export default ModalFooter;
