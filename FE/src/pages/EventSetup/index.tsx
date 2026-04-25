import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { API_CONFIG, ROUTES } from "../../constants";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { selectAuthUser, useAppSelector } from "../../store";

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

type ParticipantHistoryItem = {
  id: string;
  action?: string | null;
  fromInviteStatus?: string | null;
  toInviteStatus?: string | null;
  fromCheckInStatus?: string | null;
  toCheckInStatus?: string | null;
  note?: string | null;
  changedByEmail?: string | null;
  changedAt?: string | null;
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

// start+ chức năng đặt phòng theo sự kiện (trang setup tiện ích/dịch vụ + participants)
const EventSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();
  const currentUser = useAppSelector(selectAuthUser);
  const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [serviceDraft, setServiceDraft] = useState<Record<string, { quantity: string; note: string }>>(
    {},
  );

  const [title, setTitle] = useState("Meeting Event");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"INVITE_ONLY" | "PUBLIC">("INVITE_ONLY");

  const [inviteEmail, setInviteEmail] = useState("");
  const [participantHistoryModal, setParticipantHistoryModal] = useState<{
    open: boolean;
    participant: Participant | null;
    items: ParticipantHistoryItem[];
    loading: boolean;
    error: string | null;
  }>({ open: false, participant: null, items: [], loading: false, error: null });

  const [otpModal, setOtpModal] = useState<{
    open: boolean;
    participant: Participant | null;
    token: string | null;
    expiresAt: string | null;
    loading: boolean;
    error: string | null;
  }>({ open: false, participant: null, token: null, expiresAt: null, loading: false, error: null });

  const [checkInModal, setCheckInModal] = useState<{
    open: boolean;
    participant: Participant | null;
    otp: string;
    loading: boolean;
    error: string | null;
  }>({ open: false, participant: null, otp: "", loading: false, error: null });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [liveCode, setLiveCode] = useState<string>("");
  const [codeCountdown, setCodeCountdown] = useState<number>(0);

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

  useEffect(() => {
    if (!normalizedReservationId) return;

    const websocketUrl = normalizeSockJsUrl();
    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("[EventSetupWS] Connected to participants topic");
        client.subscribe(`/topic/reservations/${normalizedReservationId}/participants`, (frame: IMessage) => {
          if (frame.body === "UPDATED") {
            setToast({ type: "info", message: "A participant checked in! Refreshing list..." });
            loadEvent();
          }
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
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
      const email = inviteEmail.trim();
      await api.post(API_ENDPOINTS.EVENTS.INVITE_PARTICIPANT, { eventId: eventData.id, email });
      setInviteEmail("");
      setToast({ type: "success", message: "Đã mời người tham gia" });
      await loadEvent();
    } catch (err: any) {
      const raw = err?.response?.data;
      const code =
        raw?.code ||
        raw?.errorCode ||
        raw?.meta?.code ||
        raw?.meta?.errorCode ||
        raw?.data?.code ||
        raw?.data?.errorCode;
      const msg = raw?.message || raw?.meta?.message || err?.message || "Invite failed";
      const normalizedMessage = String(msg || "").toLowerCase();
      const normalizedCode = String(code || "").toUpperCase();
      if (normalizedCode.includes("USER_NOT_FOUND") || normalizedMessage.includes("user not found")) {
        setToast({ type: "error", message: "Người dùng không tồn tại" });
      } else {
        setToast({ type: "error", message: String(msg) });
      }
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async (participant: Participant) => {
    if (!participant?.id) return;
    setParticipantHistoryModal({
      open: true,
      participant,
      items: [],
      loading: true,
      error: null,
    });

    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.EVENTS.PARTICIPANT_HISTORY, { participantId: participant.id }),
      );
      const items = extractData(res);
      setParticipantHistoryModal({
        open: true,
        participant,
        items: Array.isArray(items) ? (items as ParticipantHistoryItem[]) : [],
        loading: false,
        error: null,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Load history failed";
      setParticipantHistoryModal({
        open: true,
        participant,
        items: [],
        loading: false,
        error: String(msg),
      });
    }
  };

  const createOtp = async (participant: Participant) => {
    if (!participant?.id) return;
    setOtpModal({ open: true, participant, token: null, expiresAt: null, loading: true, error: null });
    try {
      const res = await api.post(
        buildUrl(API_ENDPOINTS.CHECKIN_QR.GENERATE_PARTICIPANT_OTP, { participantId: participant.id }),
      );
      const data = extractData(res) as { token?: string; expiresAt?: string };
      setOtpModal({
        open: true,
        participant,
        token: data?.token ? String(data.token) : null,
        expiresAt: data?.expiresAt ? String(data.expiresAt) : null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Generate OTP failed";
      setOtpModal({ open: true, participant, token: null, expiresAt: null, loading: false, error: String(msg) });
    }
  };

  const respondInvitation = async (participant: Participant, response: "ACCEPT" | "DECLINE") => {
    if (!participant?.id) return;
    setLoading(true);
    try {
      await api.put(buildUrl(API_ENDPOINTS.EVENTS.RESPOND_INVITATION, { participantId: participant.id }), {
        response,
      });
      setToast({
        type: "success",
        message: response === "ACCEPT" ? "Đã chấp nhận tham gia" : "Đã từ chối tham gia",
      });
      await loadEvent();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Respond failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const openCheckInModal = (participant: Participant) => {
    setCheckInModal({ open: true, participant, otp: "", loading: false, error: null });
  };

  const submitCheckIn = async () => {
    const otp = checkInModal.otp.trim();
    if (!otp) {
      setCheckInModal((prev) => ({ ...prev, error: "Vui lòng nhập OTP" }));
      return;
    }

    setCheckInModal((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await api.post(API_ENDPOINTS.CHECKIN_QR.CONSUME, { token: otp });
      setCheckInModal({ open: false, participant: null, otp: "", loading: false, error: null });
      setToast({ type: "success", message: "Check-in thành công" });
      await loadEvent();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Check-in failed";
      setCheckInModal((prev) => ({ ...prev, loading: false, error: String(msg) }));
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

  const { code: roomCode, amenities } = getRoomInfo(detail);
  const reservationStart =
    (detail?.startTime as string | undefined) ||
    (detail?.reservation as any)?.startTime ||
    "";
  const reservationEnd =
    (detail?.endTime as string | undefined) ||
    (detail?.reservation as any)?.endTime ||
    "";
  const buildingNode: any = (detail as any)?.building ?? (detail as any)?.reservation?.building ?? null;
  const floorNode: any = (detail as any)?.floor ?? (detail as any)?.reservation?.floor ?? null;
  const buildingName = buildingNode?.name ?? buildingNode?.buildingName ?? "";
  const buildingAddress = buildingNode?.address ?? buildingNode?.location ?? "";
  const floorName = floorNode?.name ?? floorNode?.floorName ?? "";
  const roomAddressText = [buildingAddress || buildingName, floorName, roomCode].filter(Boolean).join(" • ");
  const reservationStatus =
    String((detail?.status as any) || (detail?.reservation as any)?.status || "").toUpperCase();
  const participants = eventData?.participants || [];
  const hasAnyCheckIn = participants.some((p) => String(p.checkInStatus || "").toUpperCase() === "CHECKED_IN");
  const canInvite = !hasAnyCheckIn && reservationStatus !== "IN_USE" && reservationStatus !== "CHECKED_IN";
  const selfParticipant = participants.find(
    (p) => (p.email || "").trim().toLowerCase() && (p.email || "").trim().toLowerCase() === currentUserEmail,
  );
  const canManageEvent = !selfParticipant;

  const loadLiveCode = async () => {
    if (!normalizedReservationId || !canManageEvent) return;
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
    if (canManageEvent && normalizedReservationId && reservationStatus === "IN_USE") {
      loadLiveCode();
      const timer = setInterval(loadLiveCode, 30000); // Refresh every 30s
      return () => clearInterval(timer);
    }
  }, [canManageEvent, normalizedReservationId, reservationStatus]);

  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (canManageEvent && reservationStatus === "IN_USE") {
      loadLiveCode();
    }
  }, [codeCountdown, canManageEvent, reservationStatus]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Event</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reservation: <span className="font-semibold">{normalizedReservationId}</span> • Room:{" "}
            <span className="font-semibold">{roomCode || "-"}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Address: <span className="font-semibold">{roomAddressText || "-"}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Time: <span className="font-semibold">{reservationStart || "-"}</span> →{" "}
            <span className="font-semibold">{reservationEnd || "-"}</span>
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
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Event info</h2>
          <p className="mt-1 text-sm text-slate-500">
            Thông tin sự kiện gắn với reservation.
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
              {eventData?.id ? "Update event" : "Create event"}
            </button>

            {canManageEvent && reservationStatus === "IN_USE" && (
              <div className="mt-4 rounded-xl bg-orange-50 p-4 border border-orange-200">
                <div className="text-xs font-bold text-orange-600 uppercase tracking-wider">Live Check-in Code</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-mono font-bold text-orange-700 tracking-widest">{liveCode || "------"}</span>
                  <span className="text-xs text-orange-500 font-medium">({codeCountdown}s)</span>
                </div>
                <p className="mt-2 text-xs text-orange-600">Give this 6-digit code to participants for check-in. It refreshes every minute.</p>
              </div>
            )}
            {canManageEvent && reservationStatus !== "IN_USE" && reservationStatus !== "COMPLETED" && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-center">
                <p className="text-sm text-slate-600 italic mb-3">Please check-in to this booking first to see the event code.</p>
                <button
                  disabled={loading}
                  onClick={handleOwnerCheckIn}
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Check-in now
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Dịch vụ / tiện ích thuê</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ví dụ: mic, bàn ghế… (lưu theo reservation).
          </p>

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
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Participants</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mời người tham gia bằng email (phải tồn tại trong hệ thống) + danh sách check-in.
        </p>

        {canManageEvent ? (
          <>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email người tham gia..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                disabled={!canInvite}
              />

              <button
                disabled={loading || !eventData?.id || !inviteEmail.trim() || !canInvite}
                onClick={invite}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                Mời tham gia
              </button>
            </div>

            {!canInvite ? (
              <div className="mt-2 text-xs text-slate-500">
                Không thể thêm người tham gia sau khi đã bắt đầu check-in.
              </div>
            ) : null}
          </>
        ) : null}

        {selfParticipant ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-bold text-slate-900">Phản hồi lời mời của bạn</div>
            <div className="mt-1 text-sm text-slate-600">
              Trạng thái:{" "}
              <span className="font-semibold">{selfParticipant.inviteStatus || "-"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {String(selfParticipant.inviteStatus || "").toUpperCase() === "INVITED" ? (
                <>
                  <button
                    disabled={loading}
                    onClick={() => respondInvitation(selfParticipant, "ACCEPT")}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Chấp nhận
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => respondInvitation(selfParticipant, "DECLINE")}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    Từ chối
                  </button>
                </>
              ) : null}

              {String(selfParticipant.inviteStatus || "").toUpperCase() === "ACCEPTED" &&
              String(selfParticipant.checkInStatus || "").toUpperCase() !== "CHECKED_IN" ? (
                <button
                  disabled={loading}
                  onClick={() => openCheckInModal(selfParticipant)}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  CheckIn
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Email</th>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Name</th>
                <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Invite</th>
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
                    <td className="px-3 py-2">{p.inviteStatus || "-"}</td>
                    <td className="px-3 py-2">
                      {p.checkInStatus || "-"} {p.checkInTime ? `(${p.checkInTime})` : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={loading}
                          onClick={() => openHistory(p)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          History
                        </button>

                        {canManageEvent ? (
                          <>
                            {/* <button
                              disabled={loading || String(p.inviteStatus || "").toUpperCase() !== "ACCEPTED"}
                              onClick={() => createOtp(p)}
                              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-60"
                            >
                              Create OTP
                            </button> */}

                            <button
                              disabled={loading}
                              onClick={() => removeParticipant(p.id)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                    No participants.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {participantHistoryModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-slate-900">Lịch sử trạng thái</div>
                <div className="mt-1 text-sm text-slate-600">
                  {participantHistoryModal.participant?.email || "-"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setParticipantHistoryModal({
                    open: false,
                    participant: null,
                    items: [],
                    loading: false,
                    error: null,
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              {participantHistoryModal.loading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : participantHistoryModal.error ? (
                <div className="text-sm text-red-600">{participantHistoryModal.error}</div>
              ) : participantHistoryModal.items.length ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">At</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Action</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Invite</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">Check-in</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase text-slate-500">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {participantHistoryModal.items.map((h) => (
                        <tr key={h.id}>
                          <td className="px-3 py-2">{h.changedAt || "-"}</td>
                          <td className="px-3 py-2">{h.action || "-"}</td>
                          <td className="px-3 py-2">
                            {(h.fromInviteStatus || "-") + " → " + (h.toInviteStatus || "-")}
                          </td>
                          <td className="px-3 py-2">
                            {(h.fromCheckInStatus || "-") + " → " + (h.toCheckInStatus || "-")}
                          </td>
                          <td className="px-3 py-2">{h.changedByEmail || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No history.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {otpModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-slate-900">OTP Check-in</div>
                <div className="mt-1 text-sm text-slate-600">{otpModal.participant?.email || "-"}</div>
              </div>
              <button
                type="button"
                onClick={() => setOtpModal({ open: false, participant: null, token: null, expiresAt: null, loading: false, error: null })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              {otpModal.loading ? (
                <div className="text-sm text-slate-500">Generating...</div>
              ) : otpModal.error ? (
                <div className="text-sm text-red-600">{otpModal.error}</div>
              ) : otpModal.token ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">OTP</div>
                  <div className="mt-2 text-3xl font-black tracking-widest text-slate-900">
                    {otpModal.token}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Expires at: <span className="font-semibold">{otpModal.expiresAt || "-"}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No OTP.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {checkInModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-slate-900">Check-in</div>
                <div className="mt-1 text-sm text-slate-600">{checkInModal.participant?.email || "-"}</div>
              </div>
              <button
                type="button"
                onClick={() => setCheckInModal({ open: false, participant: null, otp: "", loading: false, error: null })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={checkInModal.otp}
                onChange={(e) => setCheckInModal((prev) => ({ ...prev, otp: e.target.value }))}
                placeholder="Nhập OTP..."
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                disabled={checkInModal.loading}
              />
              {checkInModal.error ? (
                <div className="text-sm text-red-600">{checkInModal.error}</div>
              ) : null}
              <button
                disabled={checkInModal.loading}
                onClick={submitCheckIn}
                className="w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                Xác nhận CheckIn
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default EventSetupPage;
// end+ chức năng đặt phòng theo sự kiện (trang setup tiện ích/dịch vụ + participants)
