import React from "react";
import { ArrowPathIcon, Bars3Icon } from "@heroicons/react/24/outline";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import BarChart from "../../components/ui/BarChart";
import PieChart from "../../components/ui/PieChart";
import StatCards from "../../components/ui/StatCards";
import SummaryStrip from "../../components/ui/SummaryStrip";
import { useDashboard } from "../../hooks/useDashboard";

// ── AdminDashboardPage ────────────────────────────────────────────────────────
const AdminDashboardPage: React.FC = () => {
  const {
    loading,
    refreshing,
    error,
    stats,
    adminName,
    adminEmail,
    refresh,
    handleLogout,
  } = useDashboard();

  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_15%,#e0f2fe_0%,#f8fafc_40%,#f8fafc_100%)]">
      {/* ── Sidebar ── */}
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* ── Main content ── */}
      <main className="min-h-screen px-4 pb-8 pt-5 lg:ml-72 lg:px-8">
        {/* Header */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Title block */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label="Open sidebar"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
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
                  Track bookings, users, and room usage trends.
                </p>
              </div>
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </section>

        {/* Error banner */}
        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCards loading={loading} stats={stats} />
        </section>

        {/* ── Charts row ── */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr,380px]">
          {/* Bar Chart — Daily Trend */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                7-day booking trend
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Bookings created per day
              </p>
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
              <h2 className="text-lg font-semibold text-slate-900">
                Status distribution
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                This month by booking status
              </p>
            </div>
            {loading ? (
              <div className="flex items-center gap-4">
                <div className="h-44 w-44 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-4 animate-pulse rounded bg-slate-100"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <PieChart data={stats?.statusDistribution ?? []} />
            )}
          </section>
        </div>

        {/* ── Summary insight strip ── */}
        <SummaryStrip loading={loading} stats={stats} />
      </main>
    </div>
  );
};

export default AdminDashboardPage;
