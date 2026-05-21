import React, { useMemo } from "react";
import {
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import type { AdminOverviewStats } from "../../services/adminService";
import { CARD_CONFIG, formatChange, numberFmt } from "../../constants/dashboard";

// ── Skeleton Card ─────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="animate-pulse space-y-3">
      <div className="h-9 w-9 rounded-xl bg-slate-200" />
      <div className="h-3 w-28 rounded bg-slate-200" />
      <div className="h-8 w-20 rounded bg-slate-200" />
      <div className="h-3 w-24 rounded bg-slate-200" />
    </div>
  </div>
);

// ── Change Badge ──────────────────────────────────────────────────────────────
type ChangeBadgeProps = { change: number };

const ChangeBadge: React.FC<ChangeBadgeProps> = ({ change }) => {
  const positive = change > 0;
  const negative = change < 0;

  const colorClass = positive
    ? "bg-emerald-50 text-emerald-700"
    : negative
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-600";

  return (
    <div
      className={[
        "mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        colorClass,
      ].join(" ")}
    >
      {positive ? (
        <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
      ) : negative ? (
        <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
      ) : (
        <ArrowPathIcon className="h-3.5 w-3.5" />
      )}
      <span>{formatChange(change)} vs last month</span>
    </div>
  );
};

// ── StatCards ─────────────────────────────────────────────────────────────────
type StatCardsProps = {
  loading: boolean;
  stats: AdminOverviewStats | null;
};

const StatCards: React.FC<StatCardsProps> = ({ loading, stats }) => {
  const skeletons = useMemo(
    () => CARD_CONFIG.map((c) => <SkeletonCard key={c.key} />),
    [],
  );

  if (loading) return <>{skeletons}</>;

  return (
    <>
      {CARD_CONFIG.map((card) => {
        const Icon = card.icon;
        const raw  = stats?.[card.key];
        const stat =
          raw && typeof raw === "object" && "value" in raw
            ? (raw as { value: number; change: number })
            : { value: 0, change: 0 };

        const label =
          card.format === "percent"
            ? `${numberFmt.format(stat.value)}%`
            : numberFmt.format(stat.value);

        return (
          <article
            key={card.key}
            className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ${card.accent}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {card.title}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{label}</p>
            <p className="mt-1 text-sm text-slate-500">{card.hint}</p>
            <ChangeBadge change={stat.change} />
          </article>
        );
      })}
    </>
  );
};

export default StatCards;
