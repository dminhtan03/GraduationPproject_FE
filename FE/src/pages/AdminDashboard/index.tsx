import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { ROUTES } from "../../constants";
import {
  adminService,
  type AdminOverviewStats,
} from "../../services/adminService";
import { logout } from "../../services/authService";
import { api } from "../../services/api";
import { extractApiMessage } from "../../utils/errorHandlers";
import AdminSidebar from "../../components/Layout/AdminSidebar";

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type StatCard = {
  key: keyof AdminOverviewStats;
  title: string;
  hint: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accent: string;
  format: "number" | "percent";
};

const cardConfig: StatCard[] = [
  {
    key: "totalBookings",
    title: "Monthly Bookings",
    hint: "Total bookings created this month",
    icon: CalendarDaysIcon,
    accent: "from-sky-500 to-cyan-500",
    format: "number",
  },
  {
    key: "activeUsers",
    title: "Active Users",
    hint: "Unique users with booking activity",
    icon: UsersIcon,
    accent: "from-emerald-500 to-teal-500",
    format: "number",
  },
  {
    key: "utilizationRate",
    title: "Room Utilization",
    hint: "Current occupied room ratio",
    icon: ChartBarIcon,
    accent: "from-amber-500 to-orange-500",
    format: "percent",
  },
  {
    key: "todaysBookings",
    title: "Today's Bookings",
    hint: "Bookings created today",
    icon: ClockIcon,
    accent: "from-violet-500 to-fuchsia-500",
    format: "number",
  },
];

const numberFormatter = new Intl.NumberFormat("vi-VN");
const DONUT_RADIUS = 68;
const DONUT_STROKE = 14;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const formatChange = (value: number) => {
  const percentage = Number.isFinite(value) ? value * 100 : 0;
  const rounded =
    Math.abs(percentage) >= 100
      ? Math.abs(percentage).toFixed(0)
      : Math.abs(percentage).toFixed(1);

  if (percentage > 0) {
    return `+${rounded}%`;
  }

  if (percentage < 0) {
    return `-${rounded}%`;
  }

  return "0%";
};

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);

  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");

  const loadAdminProfile = async () => {
    try {
      const res = await api.get<ProfilePayload | { data: ProfilePayload }>(
        API_ENDPOINTS.AUTH.PROFILE,
      );
      const raw = res.data;
      const nested = (raw as { data?: ProfilePayload }).data;
      const data = (nested || raw || {}) as ProfilePayload;
      const fullName = [data.firstName, data.lastName]
        .filter(Boolean)
        .join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(data.email || "");
    } catch {
      setAdminName("Admin User");
      setAdminEmail("");
    }
  };

  const loadOverview = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const data = await adminService.getOverviewStats();
      setStats(data);
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to load overview statistics"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAdminProfile();
    void loadOverview();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const utilization = useMemo(() => {
    return clampPercent(stats?.utilizationRate.value ?? 0);
  }, [stats]);

  const occupiedStroke = useMemo(
    () => (utilization / 100) * DONUT_CIRCUMFERENCE,
    [utilization],
  );

  const availablePercent = useMemo(() => 100 - utilization, [utilization]);

  const utilizationLevel = useMemo(() => {
    if (utilization >= 70) {
      return { label: "High Usage", className: "text-rose-600" };
    }
    if (utilization >= 40) {
      return { label: "Balanced", className: "text-amber-600" };
    }
    return { label: "Low Usage", className: "text-emerald-600" };
  }, [utilization]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_15%,#e0f2fe_0%,#f8fafc_40%,#f8fafc_100%)]">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="min-h-screen px-4 pb-8 pt-5 lg:ml-72 lg:px-8">
        <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open admin sidebar"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Admin Analytics
                </p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Dashboard Overview
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Monitor booking growth, active users and occupancy in
                  real-time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadOverview(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? cardConfig.map((card) => (
                <div
                  key={card.key}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="animate-pulse space-y-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-200" />
                    <div className="h-3 w-28 rounded bg-slate-200" />
                    <div className="h-8 w-20 rounded bg-slate-200" />
                    <div className="h-3 w-24 rounded bg-slate-200" />
                  </div>
                </div>
              ))
            : cardConfig.map((card) => {
                const Icon = card.icon;
                const stat = stats?.[card.key] || { value: 0, change: 0 };
                const positive = stat.change > 0;
                const negative = stat.change < 0;
                const valueLabel =
                  card.format === "percent"
                    ? `${numberFormatter.format(stat.value)}%`
                    : numberFormatter.format(stat.value);

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
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {valueLabel}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{card.hint}</p>

                    <div
                      className={[
                        "mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                        positive
                          ? "bg-emerald-50 text-emerald-700"
                          : negative
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {positive ? (
                        <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
                      ) : negative ? (
                        <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                      )}
                      <span>{formatChange(stat.change)} vs last month</span>
                    </div>
                  </article>
                );
              })}
        </section>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Occupancy Snapshot
            </h2>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                utilizationLevel.className === "text-rose-600"
                  ? "bg-rose-50 text-rose-600"
                  : utilizationLevel.className === "text-amber-600"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-emerald-50 text-emerald-600",
              ].join(" ")}
            >
              {utilizationLevel.label}
            </span>
          </div>

          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[240px,1fr]">
            <div className="mx-auto flex h-56 w-56 items-center justify-center">
              <div className="relative h-52 w-52">
                <svg
                  viewBox="0 0 180 180"
                  className="h-full w-full -rotate-90"
                  aria-label="Room occupancy donut chart"
                >
                  <circle
                    cx="90"
                    cy="90"
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={DONUT_STROKE}
                  />
                  <circle
                    cx="90"
                    cy="90"
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={DONUT_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${occupiedStroke} ${DONUT_CIRCUMFERENCE}`}
                    style={{ transition: "stroke-dasharray 700ms ease" }}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Utilization
                  </p>
                  <p className="mt-1 text-4xl font-bold text-slate-900">
                    {utilization}%
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold ${utilizationLevel.className}`}
                  >
                    {utilizationLevel.label}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm font-semibold text-slate-800">
                      Occupied Rooms
                    </span>
                  </div>
                  <span className="text-lg font-bold text-amber-700">
                    {utilization}%
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />
                    <span className="text-sm font-semibold text-slate-800">
                      Available Capacity
                    </span>
                  </div>
                  <span className="text-lg font-bold text-slate-700">
                    {availablePercent}%
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-500">
                Utilization is calculated from currently unavailable rooms over
                total rooms.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
