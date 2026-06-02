import React, { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { motion, AnimatePresence } from "framer-motion";
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

  // Setup Floating UI hook with auto-flip and auto-shift boundary repositioning
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({
        padding: 8,
        fallbackPlacements: ["bottom-end", "top-start", "top-end"], // Flips to opposite side when boundary limit reached
      }),
      shift({
        padding: 8, // Shifts horizontally to prevent any boundary overflow
      }),
    ],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: true,
  });
  const role = useRole(context, { role: "dialog" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  const displayValue = useMemo(() => {
    const date = parseDateOnly(value);
    if (!date) return placeholder;

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, [value, placeholder]);

  return (
    <div className={`relative min-w-0 ${className}`}>
      {label && (
        <div className="mb-1 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
          {label}
        </div>
      )}

      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        className={[
          "relative flex w-full h-[38px] items-center justify-between border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-left bg-white text-slate-700 outline-none transition-all duration-200",
          "hover:border-orange-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100",
          open ? "border-orange-400 ring-2 ring-orange-100" : "",
        ].join(" ")}
      >
        <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <span className={`block truncate tabular-nums ${!value ? "text-slate-400" : ""}`}>
          {displayValue}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <FloatingPortal>
            <div
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: 99999 }}
              {...getFloatingProps()}
              className="outline-none"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="w-[320px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl select-none"
              >
                <style>{`
                  /* Reset and General Structure */
                  .rdp-root {
                    margin: 0 !important;
                    display: block !important;
                    position: relative !important;
                  }
                  .rdp-months {
                    display: flex !important;
                    flex-direction: column !important;
                    width: 100% !important;
                  }
                  .rdp-month {
                    width: 100% !important;
                    display: flex !important;
                    flex-direction: column !important;
                  }
                  
                  /* Align Month Title on the left */
                  .rdp-month_caption {
                    display: flex !important;
                    align-items: center !important;
                    height: 32px !important;
                    padding: 0 4px !important;
                    margin: 0 0 12px 0 !important;
                    border: none !important;
                  }
                  .rdp-caption_label {
                    font-size: 15px !important;
                    font-weight: 700 !important;
                    color: #1e293b !important;
                    text-transform: capitalize !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  /* Position Navigation Arrows in top right, inline with caption */
                  .rdp-nav {
                    display: flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                    position: absolute !important;
                    top: 0 !important;
                    right: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    z-index: 10 !important;
                    height: 32px !important;
                  }
                  .rdp-button_previous, .rdp-button_next {
                    color: #64748b !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 10px !important;
                    background: white !important;
                    width: 32px !important;
                    height: 32px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    transition: all 150ms !important;
                  }
                  .rdp-button_previous:hover, .rdp-button_next:hover {
                    background-color: #f8fafc !important;
                    color: #334155 !important;
                    border-color: #cbd5e1 !important;
                  }
                  .rdp-chevron {
                    fill: currentColor !important;
                    width: 16px !important;
                    height: 16px !important;
                    display: inline-block !important;
                  }

                  /* Table Grid & Weekdays */
                  .rdp-month_grid {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    display: table !important;
                  }
                  .rdp-weekdays {
                    display: flex !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    margin-bottom: 4px !important;
                  }
                  .rdp-weekday {
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    color: #94a3b8 !important;
                    text-transform: uppercase !important;
                    width: 40px !important;
                    height: 28px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    text-align: center !important;
                  }

                  /* Days Layout & Cells */
                  .rdp-week {
                    display: flex !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    margin-bottom: 2px !important;
                  }
                  .rdp-day {
                    width: 36px !important;
                    height: 36px !important;
                    border-radius: 12px !important;
                    font-size: 13px !important;
                    font-weight: 600 !important;
                    color: #334155 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    transition: all 150ms !important;
                    margin: 0 auto !important;
                    background: transparent !important;
                    border: none !important;
                  }
                  .rdp-day:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
                    background-color: #fff7ed !important;
                    color: #ea580c !important;
                  }
                  .rdp-day_selected {
                    background-color: #f97316 !important;
                    color: white !important;
                    font-weight: 700 !important;
                    box-shadow: 0 4px 6px -1px rgb(249 115 22 / 0.2) !important;
                  }
                  .rdp-day_today:not(.rdp-day_selected) {
                    border: 2px solid #fed7aa !important;
                    color: #ea580c !important;
                    background-color: #fff7ed !important;
                  }
                  .rdp-day_outside {
                    color: #cbd5e1 !important;
                    opacity: 0.3 !important;
                  }
                  .rdp-day_disabled {
                    color: #94a3b8 !important;
                    background-color: #f1f5f9 !important;
                    opacity: 0.5 !important;
                    cursor: not-allowed !important;
                    text-decoration: line-through !important;
                  }
                `}</style>

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
                />
              </motion.div>
            </div>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DatePickerField;
