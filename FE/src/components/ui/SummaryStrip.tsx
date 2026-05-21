import React from "react";
import type { AdminOverviewStats } from "../../services/adminService";
import { numberFmt } from "../../constants/dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────
type SummaryItem = {
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const buildSummaryItems = (stats: AdminOverviewStats): SummaryItem[] => {
  const totalBookings     = stats.totalBookings?.value     ?? 0;
  const completedBookings = stats.completedBookings?.value ?? 0;
  const completionPct =
    totalBookings > 0
      ? `${Math.round((completedBookings / totalBookings) * 100)}%`
      : "0%";

  return [
    {
      label: "Total bookings",
      value: numberFmt.format(totalBookings),
      sub:   "created",
      color: "text-sky-700",
      bg:    "bg-sky-50",
    },
    {
      label: "Completed",
      value: completionPct,
      sub:   `${numberFmt.format(completedBookings)} bookings`,
      color: "text-emerald-700",
      bg:    "bg-emerald-50",
    },
    {
      label: "Cancellation rate",
      value: `${stats.cancellationRate?.value ?? 0}%`,
      sub:   "of total bookings",
      color: "text-rose-700",
      bg:    "bg-rose-50",
    },
    {
      label: "No-show",
      value: numberFmt.format(stats.noShowBookings?.value ?? 0),
      sub:   "no check-ins",
      color: "text-amber-700",
      bg:    "bg-amber-50",
    },
  ];
};

// ── SummaryStrip ──────────────────────────────────────────────────────────────
type SummaryStripProps = {
  loading: boolean;
  stats: AdminOverviewStats | null;
};

const SummaryStrip: React.FC<SummaryStripProps> = ({ loading, stats }) => {
  if (loading || !stats) return null;

  const items = buildSummaryItems(stats);

  return (
    <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        This month summary
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className={`rounded-2xl p-4 ${item.bg}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className={`mt-2 text-2xl font-bold ${item.color}`}>
              {item.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SummaryStrip;
