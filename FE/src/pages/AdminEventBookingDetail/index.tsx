import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { API_CONFIG, ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { logout } from "../../services/authService";

type Amenity = { id: string; name: string };

type ServiceLine = {
  id: string;
  serviceItemId: string;
  name: string;
  unit?: string | null;
  priceSnapshot?: number | null;
  quantity: number;
  note?: string | null;
  status?: string | null;
};

// start+ chức năng service item status
const SERVICE_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
type ServiceStatus = typeof SERVICE_STATUSES[number];

const ACTIVE_STATUSES: ServiceStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS"];
const HISTORY_STATUSES: ServiceStatus[] = ["DONE", "CANCELLED"];

const statusConfig: Record<ServiceStatus, { label: string; bg: string; text: string }> = {
  PENDING:     { label: "Chờ duyệt",   bg: "bg-yellow-100", text: "text-yellow-700" },
  CONFIRMED:   { label: "Đã xác nhận", bg: "bg-blue-100",   text: "text-blue-700"   },
  IN_PROGRESS: { label: "Đang xử lý",  bg: "bg-orange-100", text: "text-orange-700" },
  DONE:        { label: "Hoàn thành",  bg: "bg-green-100",  text: "text-green-700"  },
  CANCELLED:   { label: "Đã huỷ",      bg: "bg-red-100",    text: "text-red-700"    },
};

const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const key = ((status || "PENDING").toUpperCase()) as ServiceStatus;
  const cfg = statusConfig[key] ?? statusConfig.PENDING;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};
// end+ chức năng service item status

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

const AdminEventBookingDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();
  const [detail, setDetail] = useState<any>(null);
  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const loadAdminProfile = async () => {
    try {
      const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
      const data = res.data?.data || res.data;
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(data.email || "");
    } catch {
      setAdminName("Admin User");
    }
  };

  const loadReservationDetail = async () => {
    if (!reservationId) return;
    try {
      const res = await reservationService.getBookingDetail(reservationId);
      setDetail(res);
    } catch (err) {
      console.error("Failed to load reservation detail", err);
    }
  };

  const loadEvent = async () => {
    if (!reservationId) return;
    try {
      const res = await api.get<any>(
        buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, { reservationId }),
      );
      setEventData(res?.data?.data || res?.data);
    } catch {
      setEventData(null);
    }
  };

  useEffect(() => {
    loadAdminProfile();
    setLoading(true);
    Promise.all([loadReservationDetail(), loadEvent()]).finally(() => setLoading(false));
  }, [reservationId]);

  useEffect(() => {
    if (!reservationId) return;
    const websocketUrl = normalizeSockJsUrl();
    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/reservations/${reservationId}/services`, (frame: IMessage) => {
          if (frame.body === "UPDATED") {
            setToast({ type: "info", message: "User updated services! Refreshing data..." });
            loadReservationDetail();
          }
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [reservationId]);

  const handleUpdateStatus = async (item: ServiceLine, newStatus: string) => {
    if (!reservationId) return;
    setUpdatingStatus(item.id);
    try {
      await api.put(
        buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEM_STATUS, {
          reservationId,
          itemId: item.id,
        }),
        { status: newStatus },
      );
      setToast({ type: "success", message: `Cập nhật thành công → ${statusConfig[newStatus as ServiceStatus]?.label ?? newStatus}` });
      await loadReservationDetail();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Cập nhật thất bại";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const allServiceLines: ServiceLine[] = useMemo(() => {
    const raw = detail?.serviceItems ?? detail?.reservation?.serviceItems ?? [];
    return Array.isArray(raw) ? (raw as ServiceLine[]) : [];
  }, [detail]);

  // start+ chức năng tách active / history
  const activeLines = useMemo(
    () => allServiceLines.filter((l) => ACTIVE_STATUSES.includes((l.status || "PENDING").toUpperCase() as ServiceStatus)),
    [allServiceLines],
  );
  const historyLines = useMemo(
    () => allServiceLines.filter((l) => HISTORY_STATUSES.includes((l.status || "PENDING").toUpperCase() as ServiceStatus)),
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
        row.estimatedTotal = (row.estimatedTotal ?? 0) + l.priceSnapshot * l.quantity;
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
  }> = ({ lines, editable, emptyText }) => (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Service</th>
            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Qty</th>
            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Note</th>
            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Trạng thái</th>
            {editable && (
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">Cập nhật</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.length ? (
            lines.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                <td className="px-4 py-3 text-slate-600">{l.quantity}</td>
                <td className="px-4 py-3 text-slate-600">{l.note || "-"}</td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                {editable && (
                  <td className="px-4 py-3 text-right">
                    <select
                      disabled={updatingStatus === l.id}
                      value={l.status || "PENDING"}
                      onChange={(e) => handleUpdateStatus(l, e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50"
                    >
                      {SERVICE_STATUSES.map((s) => (
                        <option key={s} value={s}>{statusConfig[s].label}</option>
                      ))}
                    </select>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={editable ? 5 : 4} className="px-4 py-6 text-center text-sm text-slate-500">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

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
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Event Detail (Admin)</h1>
              <p className="mt-1 text-sm text-slate-500">
                Reservation: <span className="font-semibold">{reservationId}</span> • Room:{" "}
                <span className="font-semibold">{roomCode}</span>
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back
            </button>
          </div>

          {/* Event info + Amenities */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Event information</h2>
              {eventData ? (
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  <div><span className="font-semibold">Title:</span> {eventData.title}</div>
                  <div><span className="font-semibold">Visibility:</span> {eventData.visibility}</div>
                  {eventData.description && (
                    <div><span className="font-semibold">Description:</span> {eventData.description}</div>
                  )}
                  <div>
                    <span className="font-semibold">Time:</span>{" "}
                    {new Date(startTime).toLocaleString()} → {new Date(endTime).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Event not found.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Room amenities</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {amenities.length ? (
                  amenities.map((a) => (
                    <span key={a.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
                      {a.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No amenities.</span>
                )}
              </div>
            </div>
          </div>

          {/* ── ACTIVE ORDERS ── */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Đơn dịch vụ đang xử lý</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Các yêu cầu mới nhất từ người dùng. Admin cập nhật trạng thái từng dòng.
                </p>
              </div>
              {activeLines.length > 0 && (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                  {activeLines.length} đơn
                </span>
              )}
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="text-sm text-slate-400">Loading...</div>
              ) : (
                <ServiceTable lines={activeLines} editable={true} emptyText="Không có đơn nào đang xử lý." />
              )}
            </div>
          </div>

          {/* ── HISTORY (DONE / CANCELLED) — luôn hiển thị ── */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lịch sử đơn đã hoàn thành / huỷ</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Các đơn đã xử lý xong. Không thể thay đổi trạng thái.
                </p>
              </div>
              {historyLines.length > 0 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
                  {historyLines.length} đơn
                </span>
              )}
            </div>
            <div className="mt-4">
              <ServiceTable
                lines={historyLines}
                editable={false}
                emptyText="Chưa có đơn nào được hoàn thành hoặc huỷ."
              />
            </div>
          </div>

          {/* ── SUMMARY TABLE ── */}
          {allServiceLines.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Tổng kết dịch vụ</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tổng hợp tất cả lần đặt dịch vụ trong sự kiện này.
              </p>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Dịch vụ</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Tổng SL</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Đang xử lý</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Hoàn thành</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Đã huỷ</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">Ước tính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaryRows.map((row) => (
                      <tr key={row.name} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {row.name}
                          {row.unit && <span className="ml-1 text-xs font-normal text-slate-400">/{row.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800">{row.totalQty}</td>
                        <td className="px-4 py-3 text-center">
                          {row.activeQty > 0 ? (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{row.activeQty}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.doneQty > 0 ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{row.doneQty}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.cancelledQty > 0 ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{row.cancelledQty}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {row.estimatedTotal != null
                            ? row.estimatedTotal.toLocaleString("vi-VN") + " đ"
                            : "-"}
                        </td>
                      </tr>
                    ))}

                    {/* Grand total row */}
                    {summaryRows.length > 1 && (
                      <tr className="border-t-2 border-slate-300 bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">Tổng cộng</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {summaryRows.reduce((s, r) => s + r.totalQty, 0)}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-orange-700">
                          {summaryRows.reduce((s, r) => s + r.activeQty, 0) || "-"}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-green-700">
                          {summaryRows.reduce((s, r) => s + r.doneQty, 0) || "-"}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-red-700">
                          {summaryRows.reduce((s, r) => s + r.cancelledQty, 0) || "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {summaryRows.some((r) => r.estimatedTotal != null)
                            ? summaryRows.reduce((s, r) => s + (r.estimatedTotal ?? 0), 0).toLocaleString("vi-VN") + " đ"
                            : "-"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </main>
    </div>
  );
};

export default AdminEventBookingDetailPage;
