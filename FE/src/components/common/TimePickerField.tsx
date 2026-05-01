import React from "react";
import { ClockIcon } from "@heroicons/react/24/outline";

interface TimePickerFieldProps {
  value: string;
  onChange: (nextValue: string) => void;
  label?: string;
  min?: string;
  max?: string;
  error?: string;
  disabled?: boolean;
}

const TimePickerField: React.FC<TimePickerFieldProps> = ({
  value,
  onChange,
  label,
  min,
  max,
  error,
  disabled,
}) => {
  return (
    <div className="min-w-0">
      {label && (
        <div className="mb-1 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
          {label}
        </div>
      )}
      <div
        className={[
          "relative flex items-center gap-2 rounded-xl border bg-white px-3 py-2",
          error ? "border-rose-300" : "border-slate-200",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <ClockIcon className="h-4 w-4 text-slate-400" />
        <input
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          min={min}
          max={max}
          disabled={disabled}
          className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none tabular-nums"
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
};

export default TimePickerField;
