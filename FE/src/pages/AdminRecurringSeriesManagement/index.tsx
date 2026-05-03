import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { ClockIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import { api } from "../../services/api";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { logout } from "../../services/authService";

type SeriesStatus = "ACTIVE" | "CANCELLED" | string;

type Series = {
  id: string;
  roomId: string;
  roomCode: string;
  startTimeOfDay: string;
  endTimeOfDay: string;
  daysOfWeek: string;
  purpose: string;
  note?: string | null;
  fromDate: string;
  untilDate?: string | null;
  rollingWindowWeeks?: number | null;
  status: SeriesStatus;
  lastSyncUntil?: string | null;
  createdAt?: string | null;
  userEmail?: string | null;
};

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:    { bg: "bg-green-100",  text: "text-green-700",  label: "Active" },
  CANCELLED: { bg: "bg-red-100",    text: "text-red-700",    label: "Cancelled"     },
};

const fmt = (v?: string | null) => {
  if (!v) return "-";
  try { return new Date(v).toLocaleDateString("vi-VN"); } catch { return v; }
};

const formatDaysOfWeek = (daysString?: string | null): string => {
  if (!daysString) return "-";
  const dayMap: Record<string, string> = {
    MONDAY: "Mon",
    TUESDAY: "Tue",
    WEDNESDAY: "Wed",
    THURSDAY: "Thu",
    FRIDAY: "Fri",
    SATURDAY: "Sat",
    SUNDAY: "Sun",
  };
  return daysString
    .split(",")
    .map((day) => dayMap[day.trim()] || day)
    .join(", ");
};

const formatTimeRange = (startTime?: string | null, endTime?: string | null): string => {
  if (!startTime || !endTime) return "-";
  const start = String(startTime).slice(0, 5);
  const end = String(endTime).slice(0, 5);
  return `${start} - ${end}`;
};

const formatDateRange = (fromDate?: string | null, untilDate?: string | null): string => {
  if (!fromDate) return "-";
  const from = fmt(fromDate);
  const until = untilDate ? fmt(untilDate) : null;
  return until ? `${from} → ${until}` : from;
};

// start+ chức năng admin quản lý recurring series
const AdminRecurringSeriesManagement: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "CANCELLED">("ALL");
  const [search, setSearch] = useState("");

  const loadProfile = async () => {
    try {
      const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
      const data = res.data?.data || res.data;
      setAdminName([data.firstName, data.lastName].filter(Boolean).join(" ") || "Admin User");
      setAdminEmail(data.email || "");
    } catch { /* ignore */ }
  };

  const loadSeries = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(API_ENDPOINTS.RESERVATION_SERIES.ADMIN_ALL);
      const raw = res.data?.data ?? res.data;
      setSeries(Array.isArray(raw) ? (raw as Series[]) : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to load data";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const cancelSeries = async (id: string) => {
    if (!window.confirm("Cancel this series? All future bookings will be cancelled.")) return;
    try {
      await api.delete(buildUrl(API_ENDPOINTS.RESERVATION_SERIES.CANCEL, { seriesId: id }));
      setToast({ type: "success", message: "Series cancelled successfully" });
      loadSeries();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Cancellation failed";
      setToast({ type: "error", message: String(msg) });
    }
  };

  const syncSeries = async (id: string) => {
    try {
      await api.put(buildUrl(API_ENDPOINTS.RESERVATION_SERIES.SYNC, { seriesId: id }));
      setToast({ type: "success", message: "Sync successful" });
      loadSeries();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Sync failed";
      setToast({ type: "error", message: String(msg) });
    }
  };

  useEffect(() => {
    loadProfile();
    loadSeries();
  }, []);

  const filtered = series.filter((s) => {
    const matchStatus = filterStatus === "ALL" || s.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (s.userEmail || "").toLowerCase().includes(q) ||
      (s.roomCode || "").toLowerCase().includes(q) ||
      (s.purpose || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const activeCount    = series.filter((s) => s.status === "ACTIVE").length;
  const cancelledCount = series.filter((s) => s.status === "CANCELLED").length;

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="flex-1 lg:pl-72">
        <div className="mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open admin sidebar"
                >
                  <Bars3Icon className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Recurring Series Management</h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                View and manage all recurring series from all users.
              </p>
            </div>
            <button
              onClick={loadSeries}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{series.length}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-green-600">Active</p>
              <p className="mt-1 text-3xl font-bold text-green-700">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-red-600">Cancelled</p>
              <p className="mt-1 text-3xl font-bold text-red-700">{cancelledCount}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, room, purpose..."
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
            />
            <div className="flex gap-2">
              {(["ALL", "ACTIVE", "CANCELLED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={[
                    "rounded-xl border px-4 py-2 text-sm font-semibold",
                    filterStatus === s
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Cancelled"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">User</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Room</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Time</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Days of Week</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Date Range</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Purpose</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                        No data.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => {
                      const style = statusStyle[s.status] ?? { bg: "bg-slate-100", text: "text-slate-600", label: s.status };
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-700">
                            {s.userEmail || "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {s.roomCode || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5">
                              <ClockIcon className="h-4 w-4 text-blue-600" />
                              <span className="text-xs font-semibold text-blue-700">
                                {formatTimeRange(s.startTimeOfDay, s.endTimeOfDay)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="inline-flex flex-wrap gap-1 max-w-[180px]">
                              {formatDaysOfWeek(s.daysOfWeek)
                                .split(", ")
                                .map((day) => (
                                  <span
                                    key={day}
                                    className="inline-block rounded-md bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 whitespace-nowrap"
                                  >
                                    {day}
                                  </span>
                                ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 px-2.5 py-1.5">
                              <CalendarDaysIcon className="h-4 w-4 text-orange-600" />
                              <span className="text-xs font-semibold text-orange-700">
                                {formatDateRange(s.fromDate, s.untilDate)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 max-w-[180px]">
                            <p className="line-clamp-2 text-xs">{s.purpose || "-"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              {s.status === "ACTIVE" && (
                                <>
                                  <button
                                    onClick={() => syncSeries(s.id)}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    Sync
                                  </button>
                                  <button
                                    onClick={() => cancelSeries(s.id)}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} duration={toast.type === "success" ? 2500 : 4000} />}
      </main>
    </div>
  );
};

export default AdminRecurringSeriesManagement;
// end+ chức năng admin quản lý recurring series
