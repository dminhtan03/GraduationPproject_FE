import React from "react";

export interface FormFieldProps {
  label?: string;
  optional?: boolean;
  error?: string;
  helperText?: string;
  charCount?: number;
  maxCharCount?: number;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  optional = false,
  error,
  helperText,
  charCount,
  maxCharCount,
  className = "",
  children,
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">
            {label}
          </label>
          {optional && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
              Optional
            </span>
          )}
        </div>
      )}

      <div className="relative">{children}</div>

      <div className="flex items-start justify-between gap-4">
        {error ? (
          <p className="text-xs font-medium text-red-500 transition-all duration-200">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-400 font-medium">{helperText}</p>
        ) : (
          <span />
        )}

        {charCount !== undefined && maxCharCount !== undefined && (
          <span
            className={`text-[10px] font-semibold tabular-nums ${
              charCount > maxCharCount * 0.9 ? "text-red-500" : "text-slate-400"
            }`}
          >
            {charCount} / {maxCharCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default FormField;
