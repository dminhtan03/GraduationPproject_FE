import React, { useEffect, useMemo, useRef, useState } from "react";
import { ClockIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface TimeSelectFieldProps {
  value: string;
  onChange: (nextValue: string) => void;
  label?: string;
  error?: string;
  minuteStep?: number;
  disabled?: boolean;
}

const buildHourOptions = () =>
  Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));

const buildMinuteOptions = (minuteStep: number) => {
  const step = Math.max(1, Math.min(59, Math.floor(minuteStep)));
  const count = Math.floor(60 / step);
  return Array.from({ length: count }, (_, index) =>
    String(index * step).padStart(2, "0"),
  );
};

const resolveTimeParts = (value: string) => {
  const parts = value.split(":");
  const hour = parts[0] ? parts[0].padStart(2, "0") : "00";
  const minute = parts[1] ? parts[1].padStart(2, "0") : "00";
  return { hour, minute };
};

const resolveMinuteValue = (minute: string, options: string[]) => {
  if (options.includes(minute)) return minute;
  const numeric = Number(minute);
  if (Number.isNaN(numeric)) return options[0] || "00";
  const fallback = options
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)
    .filter((value) => value <= numeric)
    .pop();
  return fallback !== undefined
    ? String(fallback).padStart(2, "0")
    : options[0] || "00";
};

const TimeSelectField: React.FC<TimeSelectFieldProps> = ({
  value,
  onChange,
  label,
  error,
  minuteStep = 5,
  disabled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [openHour, setOpenHour] = useState(false);
  const [openMinute, setOpenMinute] = useState(false);
  const hours = useMemo(() => buildHourOptions(), []);
  const minutes = useMemo(() => buildMinuteOptions(minuteStep), [minuteStep]);
  const { hour, minute } = resolveTimeParts(value);
  const safeMinute = resolveMinuteValue(minute, minutes);

  const handleHourChange = (nextHour: string) => {
    onChange(`${nextHour}:${safeMinute}`);
  };

  const handleMinuteChange = (nextMinute: string) => {
    onChange(`${hour}:${nextMinute}`);
  };

  useEffect(() => {
    if (!openHour && !openMinute) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpenHour(false);
        setOpenMinute(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openHour, openMinute]);

  return (
    <div ref={containerRef} className="min-w-0 h-full">
      {label && (
        <div className="mb-1 text-sm font-semibold text-slate-700">{label}</div>
      )}
      <div
        className={[
          "flex h-full items-center gap-2 rounded-xl border bg-white px-3 py-2",
          error ? "border-rose-300" : "border-slate-200",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <ClockIcon className="h-4 w-4 text-slate-400" />
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpenHour((prev) => !prev);
                setOpenMinute(false);
              }}
              className={[
                "flex h-9 w-16 items-center justify-center gap-1 rounded-lg border bg-slate-50 px-2 text-sm font-semibold text-slate-700 outline-none transition",
                openHour
                  ? "border-orange-300 ring-2 ring-orange-200"
                  : "border-slate-200",
              ].join(" ")}
              aria-haspopup="listbox"
              aria-expanded={openHour}
            >
              <span>{hour}</span>
              <ChevronDownIcon className="h-3 w-3 text-slate-400" />
            </button>
            <div
              className={[
                "absolute left-0 z-20 mt-2 w-16 origin-top rounded-lg border border-slate-200 bg-white shadow-lg transition",
                openHour
                  ? "scale-100 opacity-100"
                  : "pointer-events-none scale-95 opacity-0",
              ].join(" ")}
            >
              <div className="max-h-40 overflow-y-auto py-1">
                {hours.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      handleHourChange(option);
                      setOpenHour(false);
                    }}
                    className={[
                      "flex w-full items-center justify-center px-2 py-1.5 text-sm font-semibold transition",
                      option === hour
                        ? "bg-orange-500 text-white"
                        : "text-slate-700 hover:bg-orange-50 hover:text-orange-700",
                    ].join(" ")}
                    role="option"
                    aria-selected={option === hour}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-400">:</span>
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpenMinute((prev) => !prev);
                setOpenHour(false);
              }}
              className={[
                "flex h-9 w-16 items-center justify-center gap-1 rounded-lg border bg-slate-50 px-2 text-sm font-semibold text-slate-700 outline-none transition",
                openMinute
                  ? "border-orange-300 ring-2 ring-orange-200"
                  : "border-slate-200",
              ].join(" ")}
              aria-haspopup="listbox"
              aria-expanded={openMinute}
            >
              <span>{safeMinute}</span>
              <ChevronDownIcon className="h-3 w-3 text-slate-400" />
            </button>
            <div
              className={[
                "absolute left-0 z-20 mt-2 w-16 origin-top rounded-lg border border-slate-200 bg-white shadow-lg transition",
                openMinute
                  ? "scale-100 opacity-100"
                  : "pointer-events-none scale-95 opacity-0",
              ].join(" ")}
            >
              <div className="max-h-40 overflow-y-auto py-1">
                {minutes.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      handleMinuteChange(option);
                      setOpenMinute(false);
                    }}
                    className={[
                      "flex w-full items-center justify-center px-2 py-1.5 text-sm font-semibold transition",
                      option === safeMinute
                        ? "bg-orange-500 text-white"
                        : "text-slate-700 hover:bg-orange-50 hover:text-orange-700",
                    ].join(" ")}
                    role="option"
                    aria-selected={option === safeMinute}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
};

export default TimeSelectField;
