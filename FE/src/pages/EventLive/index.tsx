import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

type Amenity = { id: string; name: string };

type Participant = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  inviteStatus?: string | null;
  checkInStatus?: string | null;
  checkInTime?: string | null;
};

type EventData = {
  id: string;
  reservationId: string;
  title: string;
  description?: string | null;
  visibility: string;
  participants?: Participant[];
};

type ServiceLine = {
  id: string;
  serviceItemId: string;
  name: string;
  unit?: string | null;
  priceSnapshot?: number | null;
  quantity: number;
  note?: string | null;
};

type ServiceItem = {
  id: string;
  name: string;
  unit?: string | null;
  price?: number | null;
};

const extractData = (res: any) => (res?.data?.data ?? res?.data) as any;

const getRoomInfo = (detail: any) => {
  const room = detail?.room ?? detail?.reservation?.room ?? null;
  const code = room?.locationCode ?? room?.roomCode ?? room?.code ?? "";
  const amenities = Array.isArray(room?.amenities) ? (room.amenities as Amenity[]) : [];
  return { room, code, amenities };
};

// start+ chức năng sự kiện đang diễn ra (màn hình chi tiết + gọi thêm dịch vụ/tiện ích)
const EventLivePage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();
  const normalizedReservationId = useMemo(() => String(reservationId || "").trim(), [reservationId]);

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [addDraft, setAddDraft] = useState<Record<string, { quantity: string; note: string }>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  const loadReservationDetail = async () => {
    if (!normalizedReservationId) return;
    const res = await reservationService.getBookingDetail(normalizedReservationId);
    setDetail(res);
  };

  const loadEvent = async () => {
    if (!normalizedReservationId) return;
    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, { reservationId: normalizedReservationId }),
      );
      setEventData(extractData(res) as EventData);
    } catch {
      setEventData(null);
    }
  };

  const loadServiceItems = async () => {
    const res = await api.get(API_ENDPOINTS.SERVICE_ITEMS.LIST, { params: { activeOnly: true } });
    const raw = extractData(res);
    const list = Array.isArray(raw) ? (raw as any[]) : [];
    setServiceItems(
      list
        .map((row) => ({
          id: String(row?.id ?? ""),
          name: String(row?.name ?? ""),
          unit: row?.unit == null ? null : String(row.unit),
          price: typeof row?.price === "number" ? row.price : row?.price == null ? null : Number(row.price),
        }))
        .filter((i) => i.id && i.name),
    );
  };

  useEffect(() => {
    if (!normalizedReservationId) return;
    setLoading(true);
    Promise.all([loadReservationDetail(), loadEvent(), loadServiceItems()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [normalizedReservationId]);

  const currentServiceLines: ServiceLine[] = useMemo(() => {
    const raw = (detail as any)?.serviceItems ?? (detail as any)?.reservation?.serviceItems ?? [];
    return Array.isArray(raw) ? (raw as ServiceLine[]) : [];
  }, [detail]);

  const saveMergedServices = async () => {
    if (!normalizedReservationId) return;
    setLoading(true);
    try {
      const existing = new Map<string, { quantity: number; note: string | null }>();
      for (const line of currentServiceLines) {
        existing.set(String(line.serviceItemId), {
          quantity: Number(line.quantity || 0),
          note: typeof line.note === "string" ? line.note : null,
        });
      }

      for (const [serviceItemId, draft] of Object.entries(addDraft)) {
        const qty = Number(draft.quantity);
        if (!serviceItemId || !Number.isFinite(qty) || qty <= 0) continue;
        const prev = existing.get(serviceItemId);
        existing.set(serviceItemId, {
          quantity: (prev?.quantity || 0) + qty,
          note: draft.note?.trim() || prev?.note || null,
        });
      }

      const payload = Array.from(existing.entries())
        .map(([serviceItemId, v]) => ({
          serviceItemId,
          quantity: v.quantity,
          note: v.note,
        }))
        .filter((x) => x.serviceItemId && x.quantity > 0);

      await api.put(buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEMS, { id: normalizedReservationId }), {
        serviceItems: payload,
      });

      setAddDraft({});
      setToast({ type: "success", message: "Services updated" });
      await loadReservationDetail();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Update services failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const generateParticipantQr = async (participantId: string) => {
    setLoading(true);
    try {
      const res = await api.post(
        buildUrl(API_ENDPOINTS.CHECKIN_QR.GENERATE_PARTICIPANT, { participantId }),
      );
      const data = extractData(res) as { token: string; expiresAt: string };
      setToast({ type: "success", message: `Token: ${data.token} (expires: ${data.expiresAt})` });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Generate QR failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const { code: roomCode, amenities } = getRoomInfo(detail);
  const reservationNode: any = (detail as any)?.reservation ?? detail;
  const startTime = reservationNode?.startTime ?? reservationNode?.start_time ?? "";
  const endTime = reservationNode?.endTime ?? reservationNode?.end_time ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Live</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reservation: <span className="font-semibold">{normalizedReservationId}</span> • Room:{" "}
            <span className="font-semibold">{roomCode || "-"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={loading}
            onClick={() => navigate(`/events/setup/${normalizedReservationId}`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Setup
          </button>
          <button
            disabled={loading}
            onClick={() => navigate(-1)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Back
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Event information</h2>
          {eventData ? (
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div>
                <span className="font-semibold">Title:</span> {eventData.title}
              </div>
              <div>
                <span className="font-semibold">Visibility:</span> {eventData.visibility}
              </div>
              {eventData.description ? (
                <div>
                  <span className="font-semibold">Description:</span> {eventData.description}
                </div>
              ) : null}
              <div>
                <span className="font-semibold">Time:</span> {String(startTime)} → {String(endTime)}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-500">Event not found for this reservation.</div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Room amenities</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {amenities.length ? (
              amenities.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700"
                >
                  {a.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">No amenities.</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Services (current)</h2>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Service</th>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Qty</th>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentServiceLines.length ? (
                  currentServiceLines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">{l.name}</td>
                      <td className="px-3 py-2">{l.quantity}</td>
                      <td className="px-3 py-2">{l.note || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">
                      No services selected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Call additional services</h2>
          <p className="mt-1 text-sm text-slate-500">
            Thêm dịch vụ trong lúc sự kiện đang diễn ra (sẽ cộng dồn số lượng).
          </p>

          <div className="mt-4 space-y-3">
            {serviceItems.length ? (
              serviceItems.map((s) => {
                const draft = addDraft[s.id] || { quantity: "", note: "" };
                return (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500">
                          {s.price != null ? s.price : "-"} {s.unit ? `/${s.unit}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={draft.quantity}
                          onChange={(e) =>
                            setAddDraft((prev) => ({
                              ...prev,
                              [s.id]: { ...draft, quantity: e.target.value },
                            }))
                          }
                          placeholder="Qty"
                          inputMode="numeric"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                        />
                        <input
                          value={draft.note}
                          onChange={(e) =>
                            setAddDraft((prev) => ({
                              ...prev,
                              [s.id]: { ...draft, note: e.target.value },
                            }))
                          }
                          placeholder="Note"
                          className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500">No active service items.</div>
            )}

            <button
              disabled={loading}
              onClick={saveMergedServices}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              Save additional services
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Participants (check-in list)</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Email</th>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Name</th>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Check-in</th>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500 text-right">QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventData?.participants?.length ? (
                eventData.participants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2">{p.email || "-"}</td>
                    <td className="px-3 py-2">{p.fullName || "-"}</td>
                    <td className="px-3 py-2">
                      {p.checkInStatus || "-"} {p.checkInTime ? `(${p.checkInTime})` : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        disabled={loading}
                        onClick={() => generateParticipantQr(p.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Generate
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                    No participants.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast ? <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default EventLivePage;
// end+ chức năng sự kiện đang diễn ra (màn hình chi tiết + gọi thêm dịch vụ/tiện ích)
