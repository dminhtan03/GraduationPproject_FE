import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  Bars3Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { ROUTES } from "../../constants";
import {
  adminService,
  type AdminOverviewStats,
  type DailyTrend,
  type StatusCount,
} from "../../services/adminService";
import { logout } from "../../services/authService";
import { api } from "../../services/api";
import { extractApiMessage } from "../../utils/errorHandlers";
import AdminSidebar from "../../components/Layout/AdminSidebar";

type ProfilePayload = { firstName?: string; lastName?: string; email?: string };

// ── Stat card config ──────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const numberFmt = new Intl.NumberFormat("en-US");

const formatChange = (value: number) => {
  const pct = Number.isFinite(value) ? value * 100 : 0;
  const abs = Math.abs(pct) >= 100 ? Math.abs(pct).toFixed(0) : Math.abs(pct).toFixed(1);
  if (pct > 0) return `+${abs}%`;
  if (pct < 0) return `-${abs}%`;
  return "0%";
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED:      "#10b981",
  RESERVED:       "#3b82f6",
  IN_USE:         "#8b5cf6",
  CANCELLED:      "#ef4444",
  FORCE_CANCELLED:"#dc2626",
  NO_SHOW:        "#f59e0b",
  PENDING:        "#64748b",
  FAILED:         "#9ca3af",
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED:      "Completed",
  RESERVED:       "Reserved",
  IN_USE:         "In use",
  CANCELLED:      "Cancelled",
  FORCE_CANCELLED:"Force cancelled",
  NO_SHOW:        "No show",
  PENDING:        "Pending",
  FAILED:         "Failed",
};

// ── Bar Chart (SVG) ───────────────────────────────────────────────────────────
const BarChart: React.FC<{ data: DailyTrend[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-400">No data available</div>;
  }

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const W = 560;
  const H = 180;        // total SVG drawing height (bars + top padding)
  const PAD_T = 24;     // top padding — reserves space for value labels above tallest bar
  const PAD_L = 36;
  const PAD_B = 36;
  const CHART_H = H - PAD_T; // actual bar area height
  const barW = Math.floor((W - PAD_L - 16) / data.length) - 6;

  // Round maxVal up to a "nice" number so the top grid line matches
  const niceMax = Math.ceil(maxVal / 5) * 5 || 5;

  return (
    <svg viewBox={`0 0 ${W} ${H + PAD_B}`} className="w-full" aria-label="Daily booking bar chart">
      {/* Y grid lines — drawn from PAD_T (top) to H (bottom) */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = PAD_T + (1 - t) * CHART_H;
        return (
          <g key={t}>
            <line x1={PAD_L} y1={y} x2={W - 8} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD_L - 4} y={y + 4} fontSize={10} fill="#94a3b8" textAnchor="end">
              {Math.round(t * niceMax)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD_L + i * ((W - PAD_L - 16) / data.length) + 3;
        const bH = Math.max((d.count / niceMax) * CHART_H, d.count > 0 ? 4 : 0);
        const y = H - bH;    // bar top — minimum is PAD_T when bH = CHART_H
        const label = d.date.slice(5); // "MM-DD"
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bH}
              rx={4}
              fill="url(#barGrad)"
              opacity={0.9}
            />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 5} fontSize={10} fill="#475569" fontWeight="600" textAnchor="middle">
                {d.count}
              </text>
            )}
            <text x={x + barW / 2} y={H + PAD_B - 4} fontSize={9} fill="#94a3b8" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// ── Pie Chart (SVG) ───────────────────────────────────────────────────────────
const PieChart: React.FC<{ data: StatusCount[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-400">No data available</div>;
  }

  const R = 70;
  const CX = 90;
  const CY = 90;
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-400">No data available</div>;
  }

  let angle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = (d.count / total) * 2 * Math.PI;
    const startAngle = angle;
    angle += sweep;
    return { ...d, startAngle, sweep };
  });

  const describeArc = (start: number, sweep: number) => {
    const x1 = CX + R * Math.cos(start);
    const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(start + sweep);
    const y2 = CY + R * Math.sin(start + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0" aria-label="Booking status pie chart">
        {slices.map((s) =>
          s.sweep > 0.01 ? (
            <path
              key={s.status}
              d={describeArc(s.startAngle, s.sweep)}
              fill={STATUS_COLOR[s.status] ?? "#94a3b8"}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ) : null,
        )}
        {/* Centre hole */}
        <circle cx={CX} cy={CY} r={36} fill="#fff" />
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#1e293b">
          {total}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize={9} fill="#64748b">
          bookings
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-1 flex-col gap-1.5">
        {slices.map((s) => (
          <div key={s.status} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[s.status] ?? "#94a3b8" }}
              />
              <span className="text-slate-700">{STATUS_LABEL[s.status] ?? s.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{numberFmt.format(s.count)}</span>
              <span className="w-12 text-right text-xs text-slate-400">{s.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
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
      const res = await api.get<ProfilePayload | { data: ProfilePayload }>(API_ENDPOINTS.AUTH.PROFILE);
      const raw = res.data;
      const nested = (raw as { data?: ProfilePayload }).data;
      const data = (nested || raw || {}) as ProfilePayload;
      setAdminName([data.firstName, data.lastName].filter(Boolean).join(" ") || "Admin User");
      setAdminEmail(data.email || "");
    } catch {
      setAdminName("Admin User");
    }
  };

  const loadOverview = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await adminService.getOverviewStats();
      setStats(data);
    } catch (e) {
      setError(extractApiMessage(e, "Unable to load analytics data"));
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

  // Skeleton cards
  const skeletonCards = useMemo(
    () =>
      cardConfig.map((c) => (
        <div key={c.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-9 w-9 rounded-xl bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-8 w-20 rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-200" />
          </div>
        </div>
      )),
    [],
  );

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
        {/* Header */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Analytics</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Dashboard Overview</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Track bookings, users, and room usage trends.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadOverview(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* ── Stat Cards (3 columns on md, 6 on xl) ── */}
        <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? skeletonCards
            : cardConfig.map((card) => {
                const Icon = card.icon;
                const raw = stats?.[card.key];
                const stat = (raw && typeof raw === "object" && "value" in raw)
                  ? (raw as { value: number; change: number })
                  : { value: 0, change: 0 };
                const positive = stat.change > 0;
                const negative = stat.change < 0;
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
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{label}</p>
                    <p className="mt-1 text-sm text-slate-500">{card.hint}</p>
                    <div
                      className={[
                        "mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                        positive ? "bg-emerald-50 text-emerald-700"
                          : negative ? "bg-rose-50 text-rose-700"
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

        {/* ── Charts row ── */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr,380px]">

          {/* Bar Chart — Daily Trend */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">7-day booking trend</h2>
                <p className="mt-0.5 text-sm text-slate-500">Bookings created per day</p>
              </div>
            </div>
            {loading ? (
              <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
            ) : (
              <BarChart data={stats?.dailyTrend ?? []} />
            )}
          </section>

          {/* Pie Chart — Status Distribution */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Status distribution</h2>
              <p className="mt-0.5 text-sm text-slate-500">This month by booking status</p>
            </div>
            {loading ? (
              <div className="flex items-center gap-4">
                <div className="h-44 w-44 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              </div>
            ) : (
              <PieChart data={stats?.statusDistribution ?? []} />
            )}
          </section>
        </div>

        {/* ── Summary insight strip ── */}
        {!loading && stats && (
          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">This month summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Total bookings",
                  value: numberFmt.format(stats.totalBookings?.value ?? 0),
                  sub: "created",
                  color: "text-sky-700",
                  bg: "bg-sky-50",
                },
                {
                  label: "Completed",
                  value: (stats.totalBookings?.value ?? 0) > 0
                    ? `${Math.round(((stats.completedBookings?.value ?? 0) / stats.totalBookings.value) * 100)}%`
                    : "0%",
                  sub: `${numberFmt.format(stats.completedBookings?.value ?? 0)} bookings`,
                  color: "text-emerald-700",
                  bg: "bg-emerald-50",
                },
                {
                  label: "Cancellation rate",
                  value: `${stats.cancellationRate?.value ?? 0}%`,
                  sub: "of total bookings",
                  color: "text-rose-700",
                  bg: "bg-rose-50",
                },
                {
                  label: "No-show",
                  value: numberFmt.format(stats.noShowBookings?.value ?? 0),
                  sub: "no check-ins",
                  color: "text-amber-700",
                  bg: "bg-amber-50",
                },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl p-4 ${item.bg}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className={`mt-2 text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminDashboardPage;
