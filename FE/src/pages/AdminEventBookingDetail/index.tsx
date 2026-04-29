import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  Table,
  Tag,
  Space,
  Button,
  Card,
  Divider,
  Alert,
  Badge,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { API_CONFIG, ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { logout } from "../../services/authService";
import { formatDateTime24, formatPriceVN } from "../../utils/helpers";

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

const statusConfig: Record<ServiceStatus, { label: string; color: string }> = {
  PENDING:     { label: "Pending",    color: "warning" },
  CONFIRMED:   { label: "Confirmed",  color: "processing" },
  IN_PROGRESS: { label: "In Progress", color: "processing" },
  DONE:        { label: "Done",       color: "success" },
  CANCELLED:   { label: "Cancelled",  color: "error" },
};

const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const key = ((status || "PENDING").toUpperCase()) as ServiceStatus;
  const cfg = statusConfig[key] ?? statusConfig.PENDING;
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
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
  }> = ({ lines, editable, emptyText }) => {
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
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status: string | undefined) => <StatusBadge status={status} />,
      },
      ...(editable
        ? [
            {
              title: "Update",
              key: "action",
              width: 150,
              align: "center" as const,
              render: (_: unknown, record: ServiceLine) => (
                <select
                  disabled={updatingStatus === record.id}
                  value={record.status || "PENDING"}
                  onChange={(e) => handleUpdateStatus(record, e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50"
                >
                  {SERVICE_STATUSES.map((s) => (
                    <option key={s} value={s}>{statusConfig[s].label}</option>
                  ))}
                </select>
              ),
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
              <h1 className="text-2xl font-bold text-slate-900">Event Details (Admin)</h1>
              <p className="mt-1 text-sm text-slate-500">
                Room: <span className="font-semibold">{roomCode}</span>
              </p>
            </div>
            <Button onClick={() => navigate(-1)} type="primary">
              Back
            </Button>
          </div>

          {/* Event info + Amenities */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
            <Card title="Event Information" bordered={false} className="shadow-sm">
              {eventData ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold">Title:</span>
                    <div className="text-slate-700 mt-1">{eventData.title}</div>
                  </div>
                  <Divider style={{ margin: "8px 0" }} />
                  <div>
                    <span className="font-semibold">Visibility:</span>
                    <div className="text-slate-700 mt-1">{eventData.visibility}</div>
                  </div>
                  {eventData.description && (
                    <>
                      <Divider style={{ margin: "8px 0" }} />
                      <div>
                        <span className="font-semibold">Description:</span>
                        <div className="text-slate-700 mt-1">{eventData.description}</div>
                      </div>
                    </>
                  )}
                  <Divider style={{ margin: "8px 0" }} />
                  <div>
                    <span className="font-semibold">Time:</span>
                    <div className="text-slate-700 mt-1">
                      {formatDateTime24(startTime)} → {formatDateTime24(endTime)}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">Event not found.</span>
              )}
            </Card>

            <Card title="Room Amenities" bordered={false} className="shadow-sm">
              <div className="flex flex-wrap gap-2">
                {amenities.length ? (
                  amenities.map((a) => (
                    <Tag key={a.id} color="blue">
                      {a.name}
                    </Tag>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No amenities.</span>
                )}
              </div>
            </Card>
          </div>

          {/* ── ACTIVE ORDERS ── */}
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <span>Active Service Orders</span>
                {activeLines.length > 0 && (
                  <Badge
                    count={activeLines.length}
                    style={{ backgroundColor: "#f97316" }}
                  />
                )}
              </div>
            }
            bordered={false}
            className="shadow-sm mb-6"
          >
            <p className="text-sm text-slate-600 mb-4">
              Latest requests from users. Admin updates the status of each line.
            </p>
            {loading ? (
              <span className="text-slate-400">Loading...</span>
            ) : (
              <ServiceTable
                lines={activeLines}
                editable={true}
                emptyText="No active service orders."
              />
            )}
          </Card>

          {/* ── HISTORY (DONE / CANCELLED) ── */}
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <span>Completed / Cancelled History</span>
                {historyLines.length > 0 && (
                  <Badge count={historyLines.length} style={{ backgroundColor: "#6b7280" }} />
                )}
              </div>
            }
            bordered={false}
            className="shadow-sm mb-6"
          >
            <p className="text-sm text-slate-600 mb-4">
              Processed orders. Status cannot be changed.
            </p>
            <ServiceTable
              lines={historyLines}
              editable={false}
              emptyText="No completed or cancelled orders yet."
            />
          </Card>

          {/* ── SUMMARY TABLE ── */}
          {allServiceLines.length > 0 && (
            <Card title="Service Summary" bordered={false} className="shadow-sm">
              <p className="text-sm text-slate-600 mb-4">
                Aggregated service requests for this event.
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Service</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Total Qty</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">In Progress</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Completed</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Cancelled</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">Estimated</th>
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
                            <Badge count={row.doneQty} style={{ backgroundColor: "#10b981" }} />
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.cancelledQty > 0 ? (
                            <Badge count={row.cancelledQty} style={{ backgroundColor: "#ef4444" }} />
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
                        <td className="px-4 py-3 font-bold text-slate-900">Total</td>
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
            </Card>
          )}
        </div>

        {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </main>
    </div>
  );
};

export default AdminEventBookingDetailPage;
