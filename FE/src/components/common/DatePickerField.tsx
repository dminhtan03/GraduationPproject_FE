import React, { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import "react-day-picker/dist/style.css";

interface DatePickerFieldProps {
  value: string;
  onChange: (nextDate: string) => void;
  minDate?: string;
  maxDate?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  onInvalidSelect?: (reason: "past" | "future") => void;
}

const parseDateOnly = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  placeholder = "Select date",
  className = "",
  onInvalidSelect,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => parseDateOnly(value), [value]);
  const fromDate = useMemo(() => parseDateOnly(minDate), [minDate]);
  const toDate = useMemo(() => parseDateOnly(maxDate), [maxDate]);
  const disabledDays = useMemo(
    () => [
      ...(fromDate ? [{ before: fromDate }] : []),
      ...(toDate ? [{ after: toDate }] : []),
    ],
    [fromDate, toDate],
  );

  useEffect(() => {
    if (!open) return;

    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
    };
  }, [open]);

  const displayValue = useMemo(() => {
    const date = parseDateOnly(value);
    if (!date) return placeholder;

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, [value, placeholder]);

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      {label && (
        <div className="mb-1 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
          {label}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative w-full h-[38px] overflow-hidden border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-left bg-white text-slate-700 hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
      >
        <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <span className="block truncate tabular-nums">
          {displayValue}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-[9999] mt-2 min-w-[18rem] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <DayPicker
            mode="single"
            selected={selectedDate}
            fromDate={fromDate}
            toDate={toDate}
            disabled={disabledDays}
            onDayClick={(day, modifiers) => {
              if (modifiers.disabled && onInvalidSelect) {
                if (fromDate && day < fromDate) {
                  onInvalidSelect("past");
                } else if (toDate && day > toDate) {
                  onInvalidSelect("future");
                }
              }
            }}
            onSelect={(date) => {
              if (!date) return;
              onChange(toDateInputValue(date));
              setOpen(false);
            }}
            classNames={{
              root: "text-sm w-full",
              months: "flex w-full",
              month: "w-full space-y-2",
              caption: "flex items-center justify-between px-1 py-1",
              caption_label: "text-base font-semibold text-slate-700",
              nav: "flex items-center gap-1",
              button_previous:
                "h-8 w-8 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100",
              button_next:
                "h-8 w-8 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100",
              month_grid:
                "w-full border-separate border-spacing-y-1 border-spacing-x-1 table-fixed",
              weekdays: "w-full",
              weekday:
                "h-8 w-9 text-center text-[12px] font-semibold text-slate-500",
              week: "w-full",
              day: "h-9 w-9 p-0 text-center",
              day_button:
                "h-9 w-9 rounded-md text-sm font-semibold text-slate-900 hover:bg-slate-100",
              day_selected: "!bg-orange-500 !text-white hover:!bg-orange-600",
              day_today: "border border-orange-300 text-orange-600",
              day_outside: "text-slate-300 opacity-30",
              day_disabled:
                "!opacity-10 cursor-not-allowed pointer-events-none line-through text-slate-400 bg-slate-400 saturate-0 brightness-50",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DatePickerField;
