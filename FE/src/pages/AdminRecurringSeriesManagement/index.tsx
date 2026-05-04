import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Modal } from "antd";
import {
  Bars3Icon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ClockIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import { api } from "../../services/api";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { CustomPagination } from "../../components/common";
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

const statusStyle: Record<string, { bg: string; text: string; label: string }> =
  {
    ACTIVE: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
    FORCE_CANCELLED: {
      bg: "bg-red-100",
      text: "text-red-700",
      label: "Force Cancelled",
    },
  };

const normalizeSeriesStatus = (value?: SeriesStatus) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");

const isCancelledSeriesStatus = (value?: SeriesStatus) => {
  const normalized = normalizeSeriesStatus(value);
  return normalized === "CANCELLED" || normalized === "FORCE_CANCELLED";
};

const fmt = (v?: string | null) => {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString("vi-VN");
  } catch {
    return v;
  }
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

const formatTimeRange = (
  startTime?: string | null,
  endTime?: string | null,
): string => {
  if (!startTime || !endTime) return "-";
  const start = String(startTime).slice(0, 5);
  const end = String(endTime).slice(0, 5);
  return `${start} - ${end}`;
};

const formatDateRange = (
  fromDate?: string | null,
  untilDate?: string | null,
): string => {
  if (!fromDate) return "-";
  const from = fmt(fromDate);
  const until = untilDate ? fmt(untilDate) : null;
  return until ? `${from} → ${until}` : from;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      response?: { data?: { message?: unknown } };
    };

    const responseMessage = maybeError.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (typeof maybeError.message === "string" && maybeError.message.trim()) {
      return maybeError.message;
    }
  }

  return fallback;
};

// start+ chức năng admin quản lý recurring series
const AdminRecurringSeriesManagement: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");
  const [toast, setToast] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVE" | "CANCELLED"
  >("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await api.get<unknown>(API_ENDPOINTS.AUTH.PROFILE);
      const raw = res.data as { data?: unknown } | undefined;
      const data = (raw?.data ?? raw ?? {}) as {
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      setAdminName(
        [data.firstName, data.lastName].filter(Boolean).join(" ") ||
          "Admin User",
      );
      setAdminEmail(data.email || "");
    } catch {
      setAdminName("Admin User");
      setAdminEmail("");
    }
  };

  const loadSeries = async () => {
    setLoading(true);
    try {
      const res = await api.get<unknown>(
        API_ENDPOINTS.RESERVATION_SERIES.ADMIN_ALL,
      );
      const payload = res.data as { data?: unknown } | undefined;
      const raw = payload?.data ?? payload;
      setSeries(Array.isArray(raw) ? (raw as Series[]) : []);
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: getErrorMessage(err, "Failed to load data"),
      });
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (id: string) => {
    setCancelTargetId(id);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const submitCancel = async () => {
    if (!cancelTargetId) return;
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setToast({ type: "warning", message: "Please provide a cancel reason" });
      return;
    }
    if (trimmedReason.length < 5 || trimmedReason.length > 255) {
      setToast({
        type: "warning",
        message: "Reason must be between 5 and 255 characters",
      });
      return;
    }

    try {
      setCancelLoading(true);
      await api.delete(
        buildUrl(API_ENDPOINTS.RESERVATION_SERIES.CANCEL, {
          seriesId: cancelTargetId,
        }),
        { params: { reason: trimmedReason } },
      );
      setToast({ type: "success", message: "Series cancelled successfully" });
      setCancelModalOpen(false);
      loadSeries();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: getErrorMessage(err, "Cancellation failed"),
      });
    } finally {
      setCancelLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadSeries();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return series.filter((s) => {
      const normalizedStatus = normalizeSeriesStatus(s.status);
      const matchStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" && normalizedStatus === "ACTIVE") ||
        (filterStatus === "CANCELLED" &&
          isCancelledSeriesStatus(normalizedStatus));
      const matchSearch =
        !q ||
        (s.userEmail || "").toLowerCase().includes(q) ||
        (s.roomCode || "").toLowerCase().includes(q) ||
        (s.purpose || "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [filterStatus, search, series]);

  const activeCount = series.filter(
    (s) => normalizeSeriesStatus(s.status) === "ACTIVE",
  ).length;
  const cancelledCount = series.filter((s) =>
    isCancelledSeriesStatus(s.status),
  ).length;
  const showActionColumn = useMemo(
    () =>
      filtered.some((item) => normalizeSeriesStatus(item.status) === "ACTIVE"),
    [filtered],
  );
  const columnCount = showActionColumn ? 8 : 7;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedSeries = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [filterStatus, search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
          <Modal
            title={
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Cancel recurring series
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    Cancel future bookings and notify the user.
                  </p>
                </div>
              </div>
            }
            open={cancelModalOpen}
            onCancel={() => {
              if (!cancelLoading) {
                setCancelModalOpen(false);
              }
            }}
            footer={null}
            centered
            width={520}
            className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:border [&_.ant-modal-content]:border-slate-200 [&_.ant-modal-content]:p-0 [&_.ant-modal-header]:mb-0 [&_.ant-modal-header]:rounded-t-3xl [&_.ant-modal-header]:border-b [&_.ant-modal-header]:border-slate-200 [&_.ant-modal-header]:px-6 [&_.ant-modal-header]:py-5 [&_.ant-modal-body]:px-6 [&_.ant-modal-body]:pb-6 [&_.ant-modal-body]:pt-5 [&_.ant-modal-close]:right-5 [&_.ant-modal-close]:top-5 [&_.ant-modal-close]:text-slate-400"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  This will cancel all future bookings in the series.
                </p>
                <p className="mt-1 text-sm text-red-700/90">
                  The user will be notified with the reason you provide.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Cancel reason
                </label>
                <Input.TextArea
                  value={cancelReason}
                  placeholder="Enter reason (5-255 characters)"
                  autoSize={{ minRows: 4, maxRows: 6 }}
                  maxLength={255}
                  showCount
                  onChange={(event) => setCancelReason(event.target.value)}
                  className="rounded-xl border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-100"
                />
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelLoading}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={submitCancel}
                  disabled={cancelLoading}
                  className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLoading ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </Modal>
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
                <h1 className="text-2xl font-bold text-slate-900">
                  Recurring Series Management
                </h1>
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
              <p className="text-xs font-semibold uppercase text-slate-500">
                Total
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {series.length}
              </p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-green-600">
                Active
              </p>
              <p className="mt-1 text-3xl font-bold text-green-700">
                {activeCount}
              </p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-red-600">
                Cancelled
              </p>
              <p className="mt-1 text-3xl font-bold text-red-700">
                {cancelledCount}
              </p>
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
                  {s === "ALL"
                    ? "All"
                    : s === "ACTIVE"
                      ? "Active"
                      : "Cancelled"}
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
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      Room
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      Time
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      Days of Week
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      Date Range
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      Purpose
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      Status
                    </th>
                    {showActionColumn && (
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        No data.
                      </td>
                    </tr>
                  ) : (
                    pagedSeries.map((s) => {
                      const normalizedStatus = normalizeSeriesStatus(s.status);
                      const style = statusStyle[normalizedStatus] ?? {
                        bg: "bg-slate-100",
                        text: "text-slate-600",
                        label: normalizedStatus,
                      };
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-700">
                            {s.userEmail || "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {s.roomCode || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 px-2.5 py-1.5">
                              <ClockIcon className="h-4 w-4 text-orange-600" />
                              <span className="text-xs font-semibold text-orange-700">
                                {formatTimeRange(
                                  s.startTimeOfDay,
                                  s.endTimeOfDay,
                                )}
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
                                    className="inline-block rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700 whitespace-nowrap"
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
                            <p className="line-clamp-2 text-xs">
                              {s.purpose || "-"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}
                            >
                              {style.label}
                            </span>
                          </td>
                          {showActionColumn && (
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-2">
                                {normalizeSeriesStatus(s.status) ===
                                  "ACTIVE" && (
                                  <button
                                    onClick={() => openCancelModal(s.id)}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filtered.length > 0 && totalPages > 1 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <CustomPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(nextPage) => setPage(nextPage)}
              />
            </div>
          )}
        </div>

        {toast && (
          <CustomMessage
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
            duration={toast.type === "success" ? 2500 : 4000}
          />
        )}
      </main>
    </div>
  );
};

export default AdminRecurringSeriesManagement;
// end+ chức năng admin quản lý recurring series
