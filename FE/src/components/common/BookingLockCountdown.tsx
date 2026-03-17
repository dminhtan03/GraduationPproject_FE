import React, { useEffect, useMemo, useState } from "react";

interface BookingLockCountdownProps {
  lockedUntil?: string | Date | null;
  cancellationCount?: number;
  className?: string;
  compact?: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

const parseLockDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRemainingParts = (target: Date, now: Date) => {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalSeconds,
    hh: pad(hours),
    mm: pad(minutes),
    ss: pad(seconds),
  };
};

const BookingLockCountdown: React.FC<BookingLockCountdownProps> = ({
  lockedUntil,
  cancellationCount,
  className = "",
  compact = false,
}) => {
  const [now, setNow] = useState(() => new Date());

  const lockDate = useMemo(() => parseLockDate(lockedUntil), [lockedUntil]);
  const countdown = useMemo(
    () => (lockDate ? getRemainingParts(lockDate, now) : null),
    [lockDate, now],
  );

  useEffect(() => {
    if (!lockDate) return;

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockDate]);

  if (!lockDate || !countdown || countdown.totalSeconds <= 0) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 shadow-sm ${compact ? "p-3" : "p-4"} ${className}`}
    >
      <div
        className={`flex gap-3 ${compact ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"}`}
      >
        <div>
          <p
            className={`${compact ? "text-xs" : "text-sm"} font-semibold text-rose-700`}
          >
            Booking is temporarily locked
          </p>
          <p
            className={`mt-1 text-slate-600 ${compact ? "text-xs leading-5" : "text-sm"}`}
          >
            {typeof cancellationCount === "number"
              ? `You canceled ${cancellationCount} bookings today. Please wait until the lock expires.`
              : "Please wait until the lock expires before creating a new booking."}
          </p>
        </div>

        <div
          className={`inline-flex items-center rounded-xl border border-rose-200 bg-white ${compact ? "w-full justify-between gap-1.5 px-2.5 py-2" : "gap-2 px-3 py-2"}`}
        >
          <span
            className={`font-medium uppercase text-slate-400 ${compact ? "text-[10px] tracking-[0.14em]" : "text-xs tracking-[0.18em]"}`}
          >
            Unlock in
          </span>
          <div
            className={`flex items-center font-semibold text-slate-900 ${compact ? "gap-0.5 text-sm" : "gap-1 text-base"}`}
          >
            <span
              className={`${compact ? "min-w-8 px-1.5 py-0.5" : "min-w-10 px-2 py-1"} rounded-lg bg-slate-900 text-center text-white`}
            >
              {countdown.hh}
            </span>
            <span>:</span>
            <span
              className={`${compact ? "min-w-8 px-1.5 py-0.5" : "min-w-10 px-2 py-1"} rounded-lg bg-slate-900 text-center text-white`}
            >
              {countdown.mm}
            </span>
            <span>:</span>
            <span
              className={`${compact ? "min-w-8 px-1.5 py-0.5" : "min-w-10 px-2 py-1"} rounded-lg bg-slate-900 text-center text-white`}
            >
              {countdown.ss}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingLockCountdown;
