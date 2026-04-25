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
};

const normalizeSockJsUrl = () => {
  const fallback = "http://localhost:8080/websocket";
  const input = (API_CONFIG.WEBSOCKET_URL || fallback).trim();
  try {
    if (/^wss?:\/\//i.test(input)) {
      return input.replace(/^ws/i, "http");
    }
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

  const loadAdminProfile = async () => {
    try {
      const res = await api.get(API_ENDPOINTS.AUTH.PROFILE);
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
      const res = await api.get(
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
    Promise.all([loadReservationDetail(), loadEvent()])
      .finally(() => setLoading(false));
  }, [reservationId]);

  useEffect(() => {
    if (!reservationId) return;

    const websocketUrl = normalizeSockJsUrl();
    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("[AdminEventDetailWS] Connected to services topic");
        client.subscribe(`/topic/reservations/${reservationId}/services`, (frame: IMessage) => {
          if (frame.body === "UPDATED") {
            setToast({ type: "info", message: "User updated services! Refreshing data..." });
            loadReservationDetail();
          }
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [reservationId]);

  const currentServiceLines: ServiceLine[] = useMemo(() => {
    const raw = detail?.serviceItems ?? detail?.reservation?.serviceItems ?? [];
    return Array.isArray(raw) ? (raw as ServiceLine[]) : [];
  }, [detail]);

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
                    <span className="font-semibold">Time:</span> {new Date(startTime).toLocaleString()} → {new Date(endTime).toLocaleString()}
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

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Services & Additional Requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Danh sách các dịch vụ và yêu cầu bổ sung từ người dùng (Cập nhật thời gian thực).
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Service</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Quantity</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentServiceLines.length ? (
                    currentServiceLines.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                        <td className="px-4 py-3 text-slate-600">{l.quantity}</td>
                        <td className="px-4 py-3 text-slate-600">{l.note || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                        No services requested yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </main>
    </div>
  );
};

export default AdminEventBookingDetailPage;
