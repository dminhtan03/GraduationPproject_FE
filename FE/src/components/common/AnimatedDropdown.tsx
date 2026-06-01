import React, { useState, useEffect, useRef } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";

export type AnimatedDropdownOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type AnimatedDropdownProps<T extends string> = {
  value: T;
  options: Array<AnimatedDropdownOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  ariaLabel?: string;
};

export function AnimatedDropdown<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  optionClassName = "",
  ariaLabel,
}: AnimatedDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selectedOption =
    options.find((option) => option.value === value) || options[0];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          "flex w-full h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all duration-200",
          "hover:border-slate-300 hover:bg-slate-50/20 focus:border-orange-400 focus:ring-4 focus:ring-orange-100",
          "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none",
          isOpen ? "border-orange-400 ring-4 ring-orange-100" : "",
          buttonClassName,
        ].join(" ")}
      >
        <span className="truncate">{selectedOption?.label || "Select"}</span>
        <ChevronDownIcon
          className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={[
              "absolute left-0 right-0 z-[1100] mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/5 scrollbar-thin shrink-0",
              menuClassName,
            ].join(" ")}
          >
            <ul role="listbox" className="py-0.5 space-y-0.5">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onClick={() => {
                        if (option.disabled) return;
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={[
                        "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 active:scale-[0.98]",
                        isSelected
                          ? "bg-orange-50/60 text-orange-600 font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-medium",
                        option.disabled
                          ? "cursor-not-allowed opacity-50 hover:bg-transparent"
                          : "",
                        optionClassName,
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AnimatedDropdown;
