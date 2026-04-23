import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

type ServiceItem = {
  id: string;
  name: string;
  unit?: string | null;
  price?: number | null;
};

type Amenity = { id: string; name: string };

type Participant = {
  id: string;
  userId?: string | null;
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
  visibility: "INVITE_ONLY" | "PUBLIC" | string;
  participants?: Participant[];
};

const extractData = (res: any) => (res?.data?.data ?? res?.data) as any;

const getRoomInfo = (detail: any) => {
  const room = detail?.room ?? detail?.reservation?.room ?? null;
  const code = room?.locationCode ?? room?.roomCode ?? room?.code ?? "";
  const amenities = Array.isArray(room?.amenities) ? (room.amenities as Amenity[]) : [];
  return { room, code, amenities };
};

// start+ chức năng đặt phòng theo sự kiện (trang setup tiện ích/dịch vụ + participants)
const EventSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [serviceDraft, setServiceDraft] = useState<Record<string, { quantity: string; note: string }>>(
    {},
  );

  const [title, setTitle] = useState("Meeting Event");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"INVITE_ONLY" | "PUBLIC">("INVITE_ONLY");

  const [inviteMode, setInviteMode] = useState<"email" | "userId">("email");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  const normalizedReservationId = useMemo(() => String(reservationId || "").trim(), [reservationId]);

  const loadReservationDetail = async () => {
    if (!normalizedReservationId) return;
    const res = await reservationService.getBookingDetail(normalizedReservationId);
    setDetail(res);
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

  const loadEvent = async () => {
    if (!normalizedReservationId) return;
    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, { reservationId: normalizedReservationId }),
      );
      const data = extractData(res) as EventData;
      setEventData(data);
      if (data?.title) setTitle(data.title);
      if (data?.description) setDescription(data.description || "");
      if (data?.visibility === "PUBLIC" || data?.visibility === "INVITE_ONLY") {
        setVisibility(data.visibility);
      }
    } catch {
      setEventData(null);
    }
  };

  const loadReservationServiceItems = async () => {
    if (!normalizedReservationId) return;
    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEMS, { id: normalizedReservationId }),
      );
      const lines = extractData(res);
      const next: Record<string, { quantity: string; note: string }> = {};
      if (Array.isArray(lines)) {
        for (const line of lines as any[]) {
          const serviceItemId = String(line?.serviceItemId ?? "");
          if (!serviceItemId) continue;
          next[serviceItemId] = {
            quantity: String(line?.quantity ?? "1"),
            note: typeof line?.note === "string" ? line.note : "",
          };
        }
      }
      setServiceDraft(next);
    } catch {
      setServiceDraft({});
    }
  };

  useEffect(() => {
    if (!normalizedReservationId) return;
    setLoading(true);
    Promise.all([
      loadReservationDetail(),
      loadServiceItems(),
      loadEvent(),
      loadReservationServiceItems(),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [normalizedReservationId]);

  const createOrUpdateEvent = async () => {
    if (!normalizedReservationId) return;
    setLoading(true);
    try {
      if (!eventData?.id) {
        const res = await api.post(API_ENDPOINTS.EVENTS.CREATE, {
          reservationId: normalizedReservationId,
          title: title.trim(),
          description: description.trim() || null,
          visibility,
        });
        setEventData(extractData(res) as EventData);
        setToast({ type: "success", message: "Event created" });
      } else {
        setToast({ type: "success", message: "Event already exists" });
      }
      await loadEvent();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Create event failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const saveServices = async () => {
    if (!normalizedReservationId) return;
    setLoading(true);
    try {
      const serviceItemsPayload = Object.entries(serviceDraft)
        .map(([serviceItemId, v]) => ({
          serviceItemId,
          quantity: Number(v.quantity),
          note: v.note?.trim() || null,
        }))
        .filter((x) => x.serviceItemId && Number.isFinite(x.quantity) && x.quantity > 0);

      await api.put(buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEMS, { id: normalizedReservationId }), {
        serviceItems: serviceItemsPayload,
      });

      setToast({ type: "success", message: "Services saved" });
      await loadReservationServiceItems();
      await loadReservationDetail();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Save services failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const invite = async () => {
    if (!eventData?.id) {
      setToast({ type: "error", message: "Create event first" });
      return;
    }
    setLoading(true);
    try {
      const payload =
        inviteMode === "userId"
          ? { eventId: eventData.id, userId: inviteUserId.trim() }
          : { eventId: eventData.id, email: inviteEmail.trim(), fullName: inviteFullName.trim() || null };

      await api.post(API_ENDPOINTS.EVENTS.INVITE_PARTICIPANT, payload);
      setInviteEmail("");
      setInviteFullName("");
      setInviteUserId("");
      setToast({ type: "success", message: "Participant invited" });
      await loadEvent();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Invite failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!eventData?.id) return;
    if (!window.confirm("Remove this participant?")) return;
    setLoading(true);
    try {
      await api.delete(buildUrl(API_ENDPOINTS.EVENTS.REMOVE_PARTICIPANT, { participantId }));
      setToast({ type: "success", message: "Participant removed" });
      await loadEvent();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Remove failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const goLive = () => {
    navigate(`/events/live/${normalizedReservationId}`);
  };

  const { code: roomCode, amenities } = getRoomInfo(detail);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Setup</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reservation: <span className="font-semibold">{normalizedReservationId}</span> • Room:{" "}
            <span className="font-semibold">{roomCode || "-"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={loading}
            onClick={() => navigate(ROUTES.MY_BOOKINGS)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Back
          </button>
          <button
            disabled={loading}
            onClick={goLive}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Open live screen
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Event info</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tạo event (invite-only/public) gắn với reservation.
          </p>

          <div className="mt-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="Event title"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="Description (optional)"
            />
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="INVITE_ONLY">INVITE_ONLY</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>

            <button
              disabled={loading}
              onClick={createOrUpdateEvent}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {eventData?.id ? "Event created" : "Create event"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Room amenities</h2>
          <p className="mt-1 text-sm text-slate-500">Tiện ích cố định của phòng.</p>

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
          <h2 className="text-lg font-bold text-slate-900">Services for event</h2>
          <p className="mt-1 text-sm text-slate-500">Chọn dịch vụ và lưu vào reservation.</p>

          <div className="mt-4 space-y-3">
            {serviceItems.length ? (
              serviceItems.map((s) => {
                const draft = serviceDraft[s.id] || { quantity: "", note: "" };
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
                            setServiceDraft((prev) => ({
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
                            setServiceDraft((prev) => ({
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
              onClick={saveServices}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Save services
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Participants</h2>
          <p className="mt-1 text-sm text-slate-500">Invite-only participants + check-in list.</p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={inviteMode}
              onChange={(e) => setInviteMode(e.target.value as any)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 md:w-40"
            >
              <option value="email">By email</option>
              <option value="userId">By userId</option>
            </select>

            {inviteMode === "userId" ? (
              <input
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                placeholder="User ID..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              />
            ) : (
              <>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email..."
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
                <input
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Full name (optional)"
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </>
            )}

            <button
              disabled={loading || !eventData?.id}
              onClick={invite}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              Invite
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Email</th>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Name</th>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Check-in</th>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500 text-right">Action</th>
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
                          onClick={() => removeParticipant(p.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Remove
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
      </div>

      {toast ? <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default EventSetupPage;
// end+ chức năng đặt phòng theo sự kiện (trang setup tiện ích/dịch vụ + participants)
