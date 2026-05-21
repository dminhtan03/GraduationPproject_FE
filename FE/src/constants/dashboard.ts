import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { AdminOverviewStats } from "../services/adminService";

// ── Types ─────────────────────────────────────────────────────────────────────
export type StatCard = {
  key: keyof AdminOverviewStats;
  title: string;
  hint: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accent: string;
  format: "number" | "percent";
};

// ── Stat Card Config ──────────────────────────────────────────────────────────
export const CARD_CONFIG: StatCard[] = [
  {
    key: "totalBookings",
    title: "Bookings this month",
    hint: "Total bookings created this month",
    icon: CalendarDaysIcon,
    accent: "from-sky-500 to-cyan-500",
    format: "number",
  },
  {
    key: "activeUsers",
    title: "Active users",
    hint: "Users with bookings this month",
    icon: UsersIcon,
    accent: "from-emerald-500 to-teal-500",
    format: "number",
  },
  {
    key: "completedBookings",
    title: "Completed",
    hint: "Bookings completed this month",
    icon: CheckCircleIcon,
    accent: "from-violet-500 to-purple-500",
    format: "number",
  },
  {
    key: "cancellationRate",
    title: "Cancellation rate",
    hint: "% of bookings cancelled this month",
    icon: NoSymbolIcon,
    accent: "from-rose-500 to-pink-500",
    format: "percent",
  },
  {
    key: "todaysBookings",
    title: "Bookings today",
    hint: "Bookings created today",
    icon: ClockIcon,
    accent: "from-amber-500 to-orange-500",
    format: "number",
  },
  {
    key: "noShowBookings",
    title: "No-shows this month",
    hint: "Bookings with no check-in",
    icon: ExclamationTriangleIcon,
    accent: "from-slate-500 to-slate-600",
    format: "number",
  },
];

// ── Status Mappings ────────────────────────────────────────────────────────────
export const STATUS_COLOR: Record<string, string> = {
  COMPLETED:       "#10b981",
  RESERVED:        "#3b82f6",
  IN_USE:          "#8b5cf6",
  CANCELLED:       "#ef4444",
  FORCE_CANCELLED: "#dc2626",
  NO_SHOW:         "#f59e0b",
  PENDING:         "#64748b",
  FAILED:          "#9ca3af",
};

export const STATUS_LABEL: Record<string, string> = {
  COMPLETED:       "Completed",
  RESERVED:        "Reserved",
  IN_USE:          "In use",
  CANCELLED:       "Cancelled",
  FORCE_CANCELLED: "Force cancelled",
  NO_SHOW:         "No show",
  PENDING:         "Pending",
  FAILED:          "Failed",
};

// ── Formatters ────────────────────────────────────────────────────────────────
export const numberFmt = new Intl.NumberFormat("en-US");

export const formatChange = (value: number): string => {
  const pct = Number.isFinite(value) ? value * 100 : 0;
  const abs =
    Math.abs(pct) >= 100
      ? Math.abs(pct).toFixed(0)
      : Math.abs(pct).toFixed(1);
  if (pct > 0) return `+${abs}%`;
  if (pct < 0) return `-${abs}%`;
  return "0%";
};
