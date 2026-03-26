import React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

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

function AnimatedDropdown<T extends string>({
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
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
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
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          "flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition",
          "focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-100",
          "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
          buttonClassName,
        ].join(" ")}
      >
        <span className="truncate">{selectedOption?.label || "Select"}</span>
        <ChevronDownIcon
          className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      <div
        className={[
          "absolute left-0 right-0 z-40 mt-2 origin-top rounded-xl border border-slate-200 bg-white p-1 shadow-lg transition-all duration-200",
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0",
          menuClassName,
        ].join(" ")}
      >
        <ul role="listbox" className="max-h-60 overflow-auto py-1">
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
                    "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                    isSelected
                      ? "bg-orange-50 text-orange-700"
                      : "text-slate-700 hover:bg-slate-50",
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
      </div>
    </div>
  );
}

export default AnimatedDropdown;
