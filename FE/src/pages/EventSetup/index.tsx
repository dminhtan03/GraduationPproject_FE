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
import { formatDateTime24, formatPriceVN } from "../../utils/helpers";
import {
  CheckCircleIcon,
  SparklesIcon,
  UserGroupIcon,
  ClockIcon,
  MapPinIcon,
  CogIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Manage Event</h1>
              <p className="mt-1 text-sm text-slate-500">Set up your event details, services, and invite participants</p>
              
              {/* Info Cards */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <MapPinIcon className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500">ROOM</p>
                    <p className="text-sm font-bold text-slate-900">{roomCode || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <MapPinIcon className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500">ADDRESS</p>
                    <p className="text-sm font-bold text-slate-900">{roomAddressText || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-orange-50 p-3 sm:col-span-2 lg:col-span-2">
                  <ClockIcon className="h-5 w-5 text-orange-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500">TIME</p>
                    <p className="text-sm font-bold text-slate-900">{formatDateTime24(reservationStart)} → {formatDateTime24(reservationEnd)}</p>
                  </div>
                </div>
              </div>
            </div>
            <button
              disabled={loading}
              onClick={() => navigate(ROUTES.MY_BOOKINGS)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Event Info Section */}
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900">Event Information</h2>
            </div>
            
            <p className="mb-4 text-sm text-slate-600">Configure your event details and settings</p>

            <div className="space-y-4">
              {/* Event Title */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Event Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q1 Planning Session"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Description <span className="text-slate-400">(Optional)</span></label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add event details..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="INVITE_ONLY">Invite Only</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>

              {/* Live Code Section */}
              {canManageEvent && reservationStatus === "IN_USE" && (
                <div className="mt-5 rounded-lg bg-orange-50 p-4 ring-1 ring-orange-200">
                  <p className="text-xs font-bold uppercase text-orange-600">Live Check-in Code</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-orange-700">{liveCode || "------"}</span>
                    <span className="text-xs font-medium text-orange-500">({codeCountdown}s)</span>
                  </div>
                  <p className="mt-2 text-xs text-orange-600">Share this 6-digit code with participants for check-in. Refreshes every minute.</p>
                </div>
              )}
              
              {canManageEvent && reservationStatus !== "IN_USE" && reservationStatus !== "COMPLETED" && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="mb-3 text-sm text-slate-600">Check-in to this booking first to generate the event code.</p>
                  <button
                    disabled={loading}
                    onClick={handleOwnerCheckIn}
                    className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-50"
                  >
                    Check-in Now
                  </button>
                </div>
              )}

              {/* Action Button */}
              <button
                disabled={loading}
                onClick={createOrUpdateEvent}
                className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 disabled:opacity-60"
              >
                {eventData?.id ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>

          {/* Services Section */}
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <CogIcon className="h-6 w-6 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900">Services & Amenities</h2>
            </div>

            <p className="mb-4 text-sm text-slate-600">Add services for your event (microphone, desk, chairs, etc.)</p>

            <div className="space-y-3">
              {serviceItems.length ? (
                serviceItems.map((s) => {
                  const draft = serviceDraft[s.id] || { quantity: "", note: "" };
                  return (
                    <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3.5 ring-1 ring-inset ring-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {s.price != null ? formatPriceVN(s.price) : "-"} {s.unit ? `/${s.unit}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
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
                          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                        />
                        <input
                          value={draft.note}
                          onChange={(e) =>
                            setServiceDraft((prev) => ({
                              ...prev,
                              [s.id]: { ...draft, note: e.target.value },
                            }))
                          }
                          placeholder="Note..."
                          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                  No active service items
                </div>
              )}

              <button
                disabled={loading}
                onClick={saveServices}
                className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 disabled:opacity-60"
              >
                Save Services
              </button>
            </div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="mt-6 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <UserGroupIcon className="h-6 w-6 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-900">Participants</h2>
          </div>

          <p className="mb-6 text-sm text-slate-600">Invite people by email and manage check-ins</p>

          {/* Invite Section */}
          {canManageEvent ? (
            <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Participant Email</label>
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="participant@example.com"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100"
                    disabled={!canInvite}
                  />
                </div>
                <button
                  disabled={loading || !eventData?.id || !inviteEmail.trim() || !canInvite}
                  onClick={invite}
                  className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-60"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Invite
                </button>
              </div>
              {!canInvite && (
                <p className="mt-2 text-xs text-slate-500">Cannot add participants after check-in has started.</p>
              )}
            </div>
          ) : null}

          {/* Self Participant Response */}
          {selfParticipant ? (
            <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-bold text-slate-900">Your Invitation Response</p>
              <p className="mt-1 text-sm text-slate-600">Status: <span className="font-semibold text-slate-900">{selfParticipant.inviteStatus || "-"}</span></p>
              <div className="mt-3 flex flex-wrap gap-2">
                {String(selfParticipant.inviteStatus || "").toUpperCase() === "INVITED" ? (
                  <>
                    <button
                      disabled={loading}
                      onClick={() => respondInvitation(selfParticipant, "ACCEPT")}
                      className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:flex-none"
                    >
                      Accept
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => respondInvitation(selfParticipant, "DECLINE")}
                      className="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 sm:flex-none"
                    >
                      Decline
                    </button>
                  </>
                ) : null}

                {String(selfParticipant.inviteStatus || "").toUpperCase() === "ACCEPTED" &&
                String(selfParticipant.checkInStatus || "").toUpperCase() !== "CHECKED_IN" ? (
                  <button
                    disabled={loading}
                    onClick={() => openCheckInModal(selfParticipant)}
                    className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60 sm:flex-none"
                  >
                    Check-in
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Participants Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/50">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">Email</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">Name</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">Invite</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">Check-in</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventData?.participants?.length ? (
                  eventData.participants.map((p) => (
                    <tr key={p.id} className="transition hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm text-slate-700">{p.email || "-"}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.fullName || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          String(p.inviteStatus || "").toUpperCase() === "ACCEPTED"
                            ? "bg-orange-50 text-orange-700"
                            : String(p.inviteStatus || "").toUpperCase() === "DECLINED"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {p.inviteStatus || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            String(p.checkInStatus || "").toUpperCase() === "CHECKED_IN"
                              ? "bg-orange-50 text-orange-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {p.checkInStatus || "-"}
                          </span>
                          {p.checkInTime && <span className="text-xs text-slate-400">{p.checkInTime}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1.5">
                          <button
                            disabled={loading}
                            onClick={() => openHistory(p)}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            History
                          </button>

                          {canManageEvent ? (
                            <button
                              disabled={loading}
                              onClick={() => removeParticipant(p.id)}
                              className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No participants added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
