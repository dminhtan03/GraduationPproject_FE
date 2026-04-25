import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppSelector, selectAuthUser } from "../../store";
import { isAdminUser } from "../../services/authService";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { formatDateTime24, formatPriceVN } from "../../utils/helpers";

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
  const [liveCode, setLiveCode] = useState<string>("");
  const [codeCountdown, setCodeCountdown] = useState<number>(0);
  const [checkInInput, setCheckInInput] = useState<string>("");

  const user = useAppSelector(selectAuthUser);
  const isOwnerOrAdmin = useMemo(() => {
    if (!user) return false;
    if (isAdminUser(user)) return true;
    const reservationUserId = (detail as any)?.reservation?.userId || (detail as any)?.userId;
    // user.id in store is usually string from sub or numeric id 0. 
    // Let's use string comparison for safety.
    return String(reservationUserId) === String(user.id) || (user.email && (detail as any)?.reservation?.userEmail === user.email);
  }, [user, detail]);

  const isOwnerCheckedIn = useMemo(() => {
    const status = String((detail as any)?.status || (detail as any)?.reservation?.status || "").toUpperCase();
    return status === "IN_USE" || status === "CHECKED_IN";
  }, [detail]);

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

  const loadLiveCode = async () => {
    if (!normalizedReservationId || !isOwnerOrAdmin) return;
    try {
      const res = await api.get(buildUrl(API_ENDPOINTS.CHECKIN_QR.GET_LIVE_CODE, { reservationId: normalizedReservationId }));
      const data = extractData(res);
      setLiveCode(data.token);
      
      const expiresAt = new Date(data.expiresAt).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCodeCountdown(diff);
    } catch (err) {
      console.error("Load live code failed", err);
    }
  };

  useEffect(() => {
    if (isOwnerOrAdmin && normalizedReservationId) {
      loadLiveCode();
      const timer = setInterval(loadLiveCode, 30000); // Refresh every 30s for safety
      return () => clearInterval(timer);
    }
  }, [isOwnerOrAdmin, normalizedReservationId]);

  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isOwnerOrAdmin) {
      loadLiveCode();
    }
  }, [codeCountdown, isOwnerOrAdmin]);

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

  const handleCodeCheckIn = async () => {
    if (!normalizedReservationId || !checkInInput) return;
    setLoading(true);
    try {
      await api.post(
        buildUrl(API_ENDPOINTS.CHECKIN_QR.CHECK_IN_CODE, { reservationId: normalizedReservationId }),
        null,
        { params: { code: checkInInput } }
      );
      setToast({ type: "success", message: "Check-in successful!" });
      setCheckInInput("");
      await loadEvent();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Check-in failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerCheckIn = async () => {
    if (!normalizedReservationId) return;
    setLoading(true);
    try {
      await reservationService.checkInBooking(normalizedReservationId);
      setToast({ type: "success", message: "Check-in successful!" });
      await loadReservationDetail();
      await loadLiveCode();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Check-in failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const { code: roomCode, amenities, room } = getRoomInfo(detail);
  const building = (detail as any)?.building ?? (detail as any)?.reservation?.building ?? room?.floor?.building ?? null;
  const address = building?.address || building?.name || "";

  const reservationNode: any = (detail as any)?.reservation ?? detail;
  const startTime = reservationNode?.startTime ?? reservationNode?.start_time ?? "";
  const endTime = reservationNode?.endTime ?? reservationNode?.end_time ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Live</h1>
          <p className="mt-1 text-sm text-slate-500">
            Room: <span className="font-semibold">{roomCode || "-"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwnerOrAdmin && (
            <button
              disabled={loading}
              onClick={() => navigate(`/events/setup/${normalizedReservationId}`)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Setup
            </button>
          )}
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
            <div className="mt-3 space-y-2 text-sm text-slate-700">
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
                <span className="font-semibold">Time:</span> {formatDateTime24(startTime)} → {formatDateTime24(endTime)}
              </div>
              <div>
                <span className="font-semibold">Room:</span> {roomCode || "-"}
              </div>
              {address && (
                <div>
                  <span className="font-semibold">Address:</span> {address}
                </div>
              )}
              {isOwnerOrAdmin && isOwnerCheckedIn && (
                <div className="mt-4 rounded-xl bg-orange-50 p-4 border border-orange-200">
                  <div className="text-xs font-bold text-orange-600 uppercase tracking-wider">Live Check-in Code</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-orange-700 tracking-widest">{liveCode || "------"}</span>
                    <span className="text-xs text-orange-500 font-medium">({codeCountdown}s)</span>
                  </div>
                  <p className="mt-2 text-xs text-orange-600">Give this 6-digit code to participants for check-in. It refreshes every minute.</p>
                </div>
              )}
              {isOwnerOrAdmin && !isOwnerCheckedIn && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600 italic">Please check-in to this booking first to see the event code.</p>
                  <button
                    disabled={loading}
                    onClick={handleOwnerCheckIn}
                    className="mt-3 w-full rounded-xl bg-orange-500 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    Check-in now
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-500">Event not found for this reservation.</div>
          )}
        </div>

        {isOwnerOrAdmin && (
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
        )}
      </div>

      {isOwnerOrAdmin && (
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
                            {s.price != null ? formatPriceVN(s.price) : "-"} {s.unit ? `/${s.unit}` : ""}
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
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">
          {isOwnerOrAdmin ? "Participants (check-in list)" : "My Check-in Status"}
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Email</th>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Name</th>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Check-in</th>
                {isOwnerOrAdmin && (
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500 text-right">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventData?.participants?.length ? (
                eventData.participants
                  .filter((p: any) => isOwnerOrAdmin || (user?.email && p.email === user.email))
                  .map((p: any) => {
                    const isSelf = user?.email && p.email === user.email;
                    const canCheckIn = isSelf && p.checkInStatus !== "CHECKED_IN";

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">{p.email || "-"}</td>
                        <td className="px-3 py-2">{p.fullName || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            p.checkInStatus === "CHECKED_IN" 
                              ? "bg-green-50 text-green-700 ring-green-600/20" 
                              : "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
                          }`}>
                            {p.checkInStatus || "NOT_CHECKED_IN"}
                          </span>
                          {p.checkInTime && <div className="mt-0.5 text-[10px] text-slate-400">{new Date(p.checkInTime).toLocaleTimeString()}</div>}
                        </td>
                        {isOwnerOrAdmin ? (
                          <td className="px-3 py-2 text-right">
                            <span className="text-xs text-slate-400">Owner View</span>
                          </td>
                        ) : (
                          canCheckIn && (
                            <td className="px-3 py-2 text-right">
                              {isOwnerCheckedIn ? (
                                <div className="flex justify-end gap-2">
                                  <input
                                    value={checkInInput}
                                    onChange={(e) => setCheckInInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="6-digit code"
                                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-orange-200"
                                  />
                                  <button
                                    disabled={loading || checkInInput.length !== 6}
                                    onClick={handleCodeCheckIn}
                                    className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    Check-in
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Wait for owner check-in</span>
                              )}
                            </td>
                          )
                        )}
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={isOwnerOrAdmin ? 4 : 3} className="px-3 py-6 text-center text-sm text-slate-500">
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
