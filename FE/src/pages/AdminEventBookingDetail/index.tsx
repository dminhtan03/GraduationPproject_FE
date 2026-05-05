import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Table, Badge } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftIcon,
  SparklesIcon,
  CheckCircleIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { API_CONFIG, ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { logout } from "../../services/authService";
import { formatDateTime24 } from "../../utils/helpers";

type Amenity = { id: string; name: string };

type RoomNode = {
  amenities?: Amenity[];
  locationCode?: string | null;
  roomCode?: string | null;
  roomName?: string | null;
  code?: string | null;
};

type ReservationNode = {
  serviceItems?: ServiceLine[];
  room?: RoomNode | null;
  startTime?: string | null;
  endTime?: string | null;
};

type ReservationDetail = {
  serviceItems?: ServiceLine[];
  reservation?: ReservationNode | null;
  room?: RoomNode | null;
  startTime?: string | null;
  endTime?: string | null;
} & Record<string, unknown>;

type EventData = {
  title?: string | null;
  visibility?: string | null;
  description?: string | null;
} & Record<string, unknown>;

type ServiceLine = {
  id: string;
  serviceItemId: string;
  name: string;
  unit?: string | null;
  priceSnapshot?: number | null;
  quantity: number;
  note?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

// start+ chức năng service item status
type ServiceStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED";

const ACTIVE_STATUSES: ServiceStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
];
const HISTORY_STATUSES: ServiceStatus[] = ["DONE", "CANCELLED"];

const statusConfig: Record<ServiceStatus, { label: string }> = {
  PENDING: { label: "Pending" },
  CONFIRMED: { label: "Confirmed" },
  IN_PROGRESS: { label: "In Progress" },
  DONE: { label: "Done" },
  CANCELLED: { label: "Cancelled" },
};

const StatusBadge: React.FC<{ status?: string | null; showDot?: boolean }> = ({
  status,
  showDot = true,
}) => {
  const normalized = String(status || "PENDING").toUpperCase();
  const label = statusConfig[normalized as ServiceStatus]?.label ?? status;

  const cls =
    normalized === "DONE"
      ? "bg-emerald-50 text-emerald-700"
      : normalized === "CONFIRMED" || normalized === "IN_PROGRESS"
        ? "bg-blue-50 text-blue-700"
        : normalized === "CANCELLED"
          ? "bg-red-50 text-red-600"
          : normalized === "PENDING"
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-500";
  const dotCls =
    normalized === "DONE"
      ? "bg-emerald-500"
      : normalized === "CONFIRMED" || normalized === "IN_PROGRESS"
        ? "bg-blue-500"
        : normalized === "CANCELLED"
          ? "bg-red-500"
          : normalized === "PENDING"
            ? "bg-amber-500"
            : "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />}
      {label}
    </span>
  );
};
// end+ chức năng service item status

const fmtServiceTime = (value?: string | null) => {
  if (!value) return "-";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const normalizeSockJsUrl = () => {
  const fallback = "http://localhost:8080/websocket";
  const input = (API_CONFIG.WEBSOCKET_URL || fallback).trim();
  try {
    if (/^wss?:\/\//i.test(input)) return input.replace(/^ws/i, "http");
    return input;
  } catch {
    return fallback;
  }
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

const AdminEventBookingDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");
  const [toast, setToast] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  // start+ reason modal for CANCELLED
  const [historyOpen, setHistoryOpen] = useState(true);

  const [cancelModal, setCancelModal] = useState<{
    item: ServiceLine;
    reason: string;
  } | null>(null);
  // end+ reason modal

  const loadAdminProfile = useCallback(async () => {
    try {
      const res = await api.get<unknown>(API_ENDPOINTS.AUTH.PROFILE);
      const payload = res.data as { data?: unknown } | undefined;
      const data = (payload?.data ?? payload ?? {}) as {
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      const fullName = [data.firstName, data.lastName]
        .filter(Boolean)
        .join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(data.email || "");
    } catch {
      setAdminName("Admin User");
      setAdminEmail("");
    }
  }, []);

  const loadReservationDetail = useCallback(async () => {
    if (!reservationId) return;
    try {
      const res = await reservationService.getBookingDetail(reservationId);
      setDetail(res as ReservationDetail);
    } catch (err) {
      console.error("Failed to load reservation detail", err);
    }
  }, [reservationId]);

  const loadEvent = useCallback(async () => {
    if (!reservationId) return;
    try {
      const res = await api.get<unknown>(
        buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, { reservationId }),
      );
      const payload = res.data as { data?: unknown } | undefined;
      const data = (payload?.data ?? payload ?? {}) as EventData;
      setEventData(data);
    } catch {
      setEventData(null);
    }
  }, [reservationId]);

  useEffect(() => {
    loadAdminProfile();
    setLoading(true);
    Promise.all([loadReservationDetail(), loadEvent()]).finally(() =>
      setLoading(false),
    );
  }, [loadAdminProfile, loadEvent, loadReservationDetail]);

  useEffect(() => {
    if (!reservationId) return;
    const websocketUrl = normalizeSockJsUrl();
    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(
          `/topic/reservations/${reservationId}/services`,
          (frame: IMessage) => {
            if (frame.body === "UPDATED") {
              setToast({
                type: "info",
                message: "User updated services! Refreshing data...",
              });
              loadReservationDetail();
            }
          },
        );
      },
    });
    client.activate();
    return () => {
      client.deactivate();
    };
  }, [loadReservationDetail, reservationId]);

  const doUpdateStatus = async (
    item: ServiceLine,
    newStatus: string,
    reason?: string,
  ) => {
    if (!reservationId) return;
    setUpdatingStatus(item.id);
    try {
      await api.put(
        buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEM_STATUS, {
          reservationId,
          itemId: item.id,
        }),
        { status: newStatus, reason: reason?.trim() || null },
      );
      setToast({
        type: "success",
        message: `Status updated to "${statusConfig[newStatus as ServiceStatus]?.label ?? newStatus}"`,
      });
      await loadReservationDetail();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: getErrorMessage(err, "Update failed"),
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // start+ intercept CANCELLED to collect reason first
  const handleUpdateStatus = (item: ServiceLine, newStatus: string) => {
    if (newStatus === "CANCELLED") {
      setCancelModal({ item, reason: "" });
    } else {
      doUpdateStatus(item, newStatus);
    }
  };

  const confirmCancel = async () => {
    if (!cancelModal) return;
    if (cancelModal.reason.trim().length < 2) {
      setToast({
        type: "error",
        message: "Reason must be at least 2 characters",
      });
      return;
    }
    await doUpdateStatus(cancelModal.item, "CANCELLED", cancelModal.reason);
    setCancelModal(null);
  };
  // end+ intercept CANCELLED

  const allServiceLines: ServiceLine[] = useMemo(() => {
    const raw = detail?.serviceItems ?? detail?.reservation?.serviceItems ?? [];
    return Array.isArray(raw) ? (raw as ServiceLine[]) : [];
  }, [detail]);

  // start+ chức năng tách active / history
  const activeLines = useMemo(
    () =>
      allServiceLines.filter((l) =>
        ACTIVE_STATUSES.includes(
          (l.status || "PENDING").toUpperCase() as ServiceStatus,
        ),
      ),
    [allServiceLines],
  );
  const historyLines = useMemo(
    () =>
      allServiceLines
        .filter((l) =>
          HISTORY_STATUSES.includes(
            (l.status || "PENDING").toUpperCase() as ServiceStatus,
          ),
        )
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        }),
    [allServiceLines],
  );

  // Bảng tổng số: gộp tất cả các dòng theo tên dịch vụ
  type SummaryRow = {
    name: string;
    unit: string | null;
    priceSnapshot: number | null;
    totalQty: number;
    activeQty: number;
    doneQty: number;
    cancelledQty: number;
    estimatedTotal: number | null;
  };

  const summaryRows: SummaryRow[] = useMemo(() => {
    const map = new Map<string, SummaryRow>();
    for (const l of allServiceLines) {
      const key = l.name;
      if (!map.has(key)) {
        map.set(key, {
          name: l.name,
          unit: l.unit ?? null,
          priceSnapshot: l.priceSnapshot ?? null,
          totalQty: 0,
          activeQty: 0,
          doneQty: 0,
          cancelledQty: 0,
          estimatedTotal: null,
        });
      }
      const row = map.get(key)!;
      const st = (l.status || "PENDING").toUpperCase() as ServiceStatus;
      row.totalQty += l.quantity;
      if (ACTIVE_STATUSES.includes(st)) row.activeQty += l.quantity;
      if (st === "DONE") row.doneQty += l.quantity;
      if (st === "CANCELLED") row.cancelledQty += l.quantity;
      if (l.priceSnapshot != null) {
        row.estimatedTotal =
          (row.estimatedTotal ?? 0) + l.priceSnapshot * l.quantity;
      }
    }
    return [...map.values()];
  }, [allServiceLines]);
  // end+ chức năng tách active / history

  const amenities: Amenity[] = useMemo(() => {
    const room = detail?.room ?? detail?.reservation?.room;
    return Array.isArray(room?.amenities) ? room.amenities : [];
  }, [detail]);

  const roomCode = useMemo(() => {
    const room = detail?.room ?? detail?.reservation?.room;
    return room?.locationCode || room?.roomCode || room?.code || "-";
  }, [detail]);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const reservationNode = detail?.reservation ?? detail;
  const startTime = reservationNode?.startTime || "";
  const endTime = reservationNode?.endTime || "";

  const ServiceTable: React.FC<{
    lines: ServiceLine[];
    editable: boolean;
    emptyText: string;
    showDot?: boolean;
  }> = ({ lines, editable, emptyText, showDot = true }) => {
    const columns: ColumnsType<ServiceLine> = [
      {
        title: "Service",
        dataIndex: "name",
        key: "name",
        render: (text: string) => <span className="font-medium">{text}</span>,
      },
      {
        title: "Qty",
        dataIndex: "quantity",
        key: "quantity",
        width: 60,
        align: "center",
      },
      {
        title: "Note",
        dataIndex: "note",
        key: "note",
        render: (text: string | undefined) => text || "-",
      },
      ...(!editable
        ? [
            {
              title: "Created At",
              dataIndex: "createdAt",
              key: "createdAt",
              width: 160,
              render: (v: string | undefined) => (
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {fmtServiceTime(v)}
                </span>
              ),
            },
          ]
        : []),
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status: string | undefined) => (
          <StatusBadge status={status} showDot={showDot} />
        ),
      },
      ...(editable
        ? [
            {
              title: "Update",
              key: "action",
              width: 220,
              align: "center" as const,
              render: (_: unknown, record: ServiceLine) => {
                const st = (record.status || "PENDING").toUpperCase();
                return (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {st === "PENDING" && (
                      <>
                        <button
                          type="button"
                          disabled={updatingStatus === record.id}
                          onClick={() =>
                            handleUpdateStatus(record, "CONFIRMED")
                          }
                          className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={updatingStatus === record.id}
                          onClick={() =>
                            handleUpdateStatus(record, "CANCELLED")
                          }
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          Cancelled
                        </button>
                      </>
                    )}
                    {st === "CONFIRMED" && (
                      <button
                        type="button"
                        disabled={updatingStatus === record.id}
                        onClick={() =>
                          handleUpdateStatus(record, "IN_PROGRESS")
                        }
                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
                      >
                        In Progress
                      </button>
                    )}
                    {st === "IN_PROGRESS" && (
                      <button
                        type="button"
                        disabled={updatingStatus === record.id}
                        onClick={() => handleUpdateStatus(record, "DONE")}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Done
                      </button>
                    )}
                    {(st === "CONFIRMED" || st === "IN_PROGRESS") && (
                      <button
                        type="button"
                        disabled={updatingStatus === record.id}
                        onClick={() => handleUpdateStatus(record, "CANCELLED")}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        Cancelled
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]
        : []),
    ];

    return (
      <Table<ServiceLine>
        rowKey={(record) => record.id}
        dataSource={lines}
        columns={columns}
        pagination={false}
        locale={{ emptyText }}
      />
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={false}
        onCloseMobile={() => {}}
      />

      <main className="flex-1 lg:pl-72">
        <div className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Event Details
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Room:{" "}
                <span className="font-semibold text-slate-800">{roomCode}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>
          </div>

          {/* Event info + Amenities */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
            {/* Event Information */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <SparklesIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Event Information
                </p>
              </div>
              <div className="p-5">
                {eventData ? (
                  <div className="space-y-4 text-sm">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Title
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {eventData.title}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Visibility
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {eventData.visibility}
                      </p>
                    </div>
                    {eventData.description && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Description
                        </p>
                        <p className="mt-1 text-slate-700 leading-relaxed">
                          {eventData.description}
                        </p>
                      </div>
                    )}
                    <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                        Time
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {formatDateTime24(startTime)} →{" "}
                        {formatDateTime24(endTime)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">Event not found.</span>
                )}
              </div>
            </div>

            {/* Room Amenities */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <SparklesIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Room Amenities
                </p>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  {amenities.length ? (
                    amenities.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-100"
                      >
                        {a.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">
                      No amenities.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── ACTIVE ORDERS ── */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm mb-6">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Active Service Orders
                </p>
              </div>
              {activeLines.length > 0 && (
                <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  {activeLines.length}
                </span>
              )}
            </div>
            <div className="p-5">
              <p className="mb-4 text-sm text-slate-500">
                Latest requests from users. Admin updates the status of each
                line.
              </p>
              {loading ? (
                <span className="text-slate-400">Loading...</span>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <ServiceTable
                    lines={activeLines}
                    editable={true}
                    emptyText="No active service orders."
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── HISTORY (DONE / CANCELLED) ── */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm mb-6">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center justify-between border-b border-slate-100 px-5 py-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2">
                <QueueListIcon className="h-5 w-5 text-slate-400" />
                <p className="text-base font-semibold text-slate-900">
                  Completed / Cancelled History
                </p>
                {historyLines.length > 0 && (
                  <span className="rounded-full bg-slate-500 px-2.5 py-0.5 text-xs font-bold text-white">
                    {historyLines.length}
                  </span>
                )}
              </div>
              <svg
                className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {historyOpen && (
              <div className="p-5">
                <p className="mb-4 text-sm text-slate-500">
                  Processed orders. Status cannot be changed.
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <ServiceTable
                    lines={historyLines}
                    editable={false}
                    emptyText="No completed or cancelled orders yet."
                    showDot={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── SUMMARY TABLE ── */}
          {allServiceLines.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm mb-6">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <QueueListIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Service Summary
                </p>
              </div>
              <div className="p-5">
                <p className="mb-4 text-sm text-slate-500">
                  Aggregated service requests for this event.
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                          Service
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          Total Qty
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          In Progress
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          Completed
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          Cancelled
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">
                          Estimated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryRows.map((row) => (
                        <tr key={row.name} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {row.name}
                            {row.unit && (
                              <span className="ml-1 text-xs font-normal text-slate-400">
                                /{row.unit}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-800">
                            {row.totalQty}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.activeQty > 0 ? (
                              <Badge
                                count={row.activeQty}
                                style={{ backgroundColor: "#f97316" }}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.doneQty > 0 ? (
                              <Badge
                                count={row.doneQty}
                                style={{ backgroundColor: "#10b981" }}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.cancelledQty > 0 ? (
                              <Badge
                                count={row.cancelledQty}
                                style={{ backgroundColor: "#ef4444" }}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {row.estimatedTotal != null
                              ? row.estimatedTotal.toLocaleString("vi-VN") +
                                " đ"
                              : "-"}
                          </td>
                        </tr>
                      ))}

                      {/* Grand total row */}
                      {summaryRows.length > 1 && (
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            Total
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            {summaryRows.reduce((s, r) => s + r.totalQty, 0)}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-orange-700">
                            {summaryRows.reduce((s, r) => s + r.activeQty, 0) ||
                              "-"}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-green-700">
                            {summaryRows.reduce((s, r) => s + r.doneQty, 0) ||
                              "-"}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-red-700">
                            {summaryRows.reduce(
                              (s, r) => s + r.cancelledQty,
                              0,
                            ) || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {summaryRows.some((r) => r.estimatedTotal != null)
                              ? summaryRows
                                  .reduce(
                                    (s, r) => s + (r.estimatedTotal ?? 0),
                                    0,
                                  )
                                  .toLocaleString("vi-VN") + " đ"
                              : "-"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {toast && (
          <CustomMessage
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        {/* start+ cancel reason modal */}
        {cancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">
                Cancel Service Request
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Service:{" "}
                <span className="font-semibold">{cancelModal.item.name}</span>
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Reason <span className="text-red-500">*</span>
              </p>
              <textarea
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal((prev) =>
                    prev ? { ...prev, reason: e.target.value } : prev,
                  )
                }
                rows={3}
                placeholder="Explain why this service request is being cancelled..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancelModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={confirmCancel}
                  disabled={updatingStatus !== null}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* end+ cancel reason modal */}
      </main>
    </div>
  );
};

export default AdminEventBookingDetailPage;
