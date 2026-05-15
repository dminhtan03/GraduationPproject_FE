import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { getProfile } from "../../services/authService";
import { API_CONFIG, ROUTES } from "../../constants";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { ConfirmDialog } from "../../components/common";
import { selectAuthUser, useAppSelector } from "../../store";
import { formatDateTime24, formatPriceVN } from "../../utils/helpers";
import {
  ArrowLeftIcon,
  SparklesIcon,
  UserGroupIcon,
  ClockIcon,
  MapPinIcon,
  CogIcon,
  EnvelopeIcon,
  QueueListIcon,
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
  const amenities = Array.isArray(room?.amenities)
    ? (room.amenities as Amenity[])
    : [];
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

const formatHistoryTime = (value?: string | null) =>
  value ? formatDateTime24(value) : "-";

// start+ chức năng đặt phòng theo sự kiện (trang setup tiện ích/dịch vụ + participants)
const EventSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();
  const currentUser = useAppSelector(selectAuthUser);
  const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [userStatusPay, setUserStatusPay] = useState<"NO_PAY" | "PAID" | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [serviceDraft, setServiceDraft] = useState<
    Record<string, { quantity: string; note: string }>
  >({});
  // start+ chức năng lịch sử dịch vụ: chỉ load ACTIVE vào draft, DONE/CANCELLED vào history
  type ServiceHistoryLine = {
    id: string;
    serviceItemId: string;
    name: string;
    quantity: number;
    note?: string | null;
    status: string;
    priceSnapshot?: number | null;
    unit?: string | null;
    createdAt?: string | null;
  };
  const [serviceHistory, setServiceHistory] = useState<ServiceHistoryLine[]>([]);
  const [trackingOpen, setTrackingOpen] = useState(true);
  // end+ chức năng lịch sử dịch vụ

  const [title, setTitle] = useState("Meeting Event");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"INVITE_ONLY" | "PUBLIC">(
    "INVITE_ONLY",
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [participantHistoryModal, setParticipantHistoryModal] = useState<{
    open: boolean;
    participant: Participant | null;
    items: ParticipantHistoryItem[];
    loading: boolean;
    error: string | null;
  }>({
    open: false,
    participant: null,
    items: [],
    loading: false,
    error: null,
  });

  const [otpModal, setOtpModal] = useState<{
    open: boolean;
    participant: Participant | null;
    token: string | null;
    expiresAt: string | null;
    loading: boolean;
    error: string | null;
  }>({
    open: false,
    participant: null,
    token: null,
    expiresAt: null,
    loading: false,
    error: null,
  });

  const [checkInModal, setCheckInModal] = useState<{
    open: boolean;
    participant: Participant | null;
    otp: string;
    loading: boolean;
    error: string | null;
  }>({ open: false, participant: null, otp: "", loading: false, error: null });
  const [pendingRemoveParticipant, setPendingRemoveParticipant] =
    useState<Participant | null>(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [liveCode, setLiveCode] = useState<string>("");
  const [codeCountdown, setCodeCountdown] = useState<number>(0);

  const normalizedReservationId = useMemo(
    () => String(reservationId || "").trim(),
    [reservationId],
  );

  const loadReservationDetail = async () => {
    if (!normalizedReservationId) return;
    const res = await reservationService.getBookingDetail(
      normalizedReservationId,
    );
    setDetail(res);
  };

  const loadServiceItems = async () => {
    const res = await api.get(API_ENDPOINTS.SERVICE_ITEMS.LIST, {
      params: { activeOnly: true },
    });
    const raw = extractData(res);
    const list = Array.isArray(raw) ? (raw as any[]) : [];
    setServiceItems(
      list
        .map((row) => ({
          id: String(row?.id ?? ""),
          name: String(row?.name ?? ""),
          unit: row?.unit == null ? null : String(row.unit),
          price:
            typeof row?.price === "number"
              ? row.price
              : row?.price == null
                ? null
                : Number(row.price),
        }))
        .filter((i) => i.id && i.name),
    );
  };

  const loadEvent = async () => {
    if (!normalizedReservationId) return;
    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, {
          reservationId: normalizedReservationId,
        }),
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
        buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEMS, {
          id: normalizedReservationId,
        }),
      );
      const lines = extractData(res);
      // start+ chức năng lịch sử dịch vụ: tách ACTIVE vs DONE/CANCELLED
      const history: ServiceHistoryLine[] = [];
      if (Array.isArray(lines)) {
        for (const line of lines as any[]) {
          const serviceItemId = String(line?.serviceItemId ?? "");
          if (!serviceItemId) continue;
          const lineStatus = String(line?.status ?? "PENDING").toUpperCase();
          history.push({
            id: String(line?.id ?? ""),
            serviceItemId,
            name: String(line?.name ?? serviceItemId),
            quantity: Number(line?.quantity ?? 0),
            note: typeof line?.note === "string" ? line.note : null,
            status: lineStatus,
            priceSnapshot: line?.priceSnapshot ?? null,
            unit: line?.unit ?? null,
            createdAt: line?.createdAt ?? null,
          });
        }
      }
      history.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setServiceDraft({});
      setServiceHistory(history);
      // end+ chức năng lịch sử dịch vụ
    } catch {
      setServiceDraft({});
      setServiceHistory([]);
    }
  };

  useEffect(() => {
    if (!normalizedReservationId) return;
    setLoading(true);
    // Fetch user statusPay
    getProfile().then((res) => {
      const data = (res as any)?.data?.data ?? (res as any)?.data;
      setUserStatusPay(data?.statusPay ?? null);
    }).catch(() => {});

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
        client.subscribe(
          `/topic/reservations/${normalizedReservationId}/participants`,
          (frame: IMessage) => {
            if (frame.body === "UPDATED") {
              setToast({
                type: "info",
                message: "A participant checked in! Refreshing list...",
              });
              loadEvent();
            }
          },
        );
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
      const msg =
        err?.response?.data?.message || err?.message || "Create event failed";
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
        .filter(
          (x) =>
            x.serviceItemId && Number.isFinite(x.quantity) && x.quantity > 0,
        );

      await api.put(
        buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEMS, {
          id: normalizedReservationId,
        }),
        {
          serviceItems: serviceItemsPayload,
        },
      );

      setToast({ type: "success", message: "Services saved" });
      await loadReservationServiceItems();
      await loadReservationDetail();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Save services failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      setToast({ type: "error", message: "Please enter an email address" });
      return;
    }
    setLoading(true);
    try {
      // Auto-create event if it doesn't exist yet — check email first by just attempting the invite
      // If event not created → create it first, then invite
      let eventId = eventData?.id;
      if (!eventId) {
        const res = await api.post(API_ENDPOINTS.EVENTS.CREATE, {
          reservationId: normalizedReservationId,
          title: title.trim(),
          description: description.trim() || null,
          visibility,
        });
        const newEvent = extractData(res) as EventData;
        setEventData(newEvent);
        eventId = newEvent?.id;
        if (!eventId) {
          setToast({ type: "error", message: "Failed to create event" });
          return;
        }
      }

      await api.post(API_ENDPOINTS.EVENTS.INVITE_PARTICIPANT, { eventId, email });
      setInviteEmail("");
      setToast({ type: "success", message: "Participant invited successfully" });
      await loadEvent();
    } catch (err: any) {
      const raw = err?.response?.data;
      const code = raw?.code || raw?.errorCode || raw?.meta?.code || raw?.meta?.errorCode || raw?.data?.code || raw?.data?.errorCode;
      const msg = raw?.message || raw?.meta?.message || err?.message || "Invite failed";
      const normalizedCode = String(code || "").toUpperCase();
      const normalizedMessage = String(msg || "").toLowerCase();
      if (normalizedCode.includes("USER_NOT_FOUND") || normalizedMessage.includes("user not found")) {
        setToast({ type: "error", message: "User not found. Please check the email address and try again." });
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
        buildUrl(API_ENDPOINTS.EVENTS.PARTICIPANT_HISTORY, {
          participantId: participant.id,
        }),
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
      const msg =
        err?.response?.data?.message || err?.message || "Load history failed";
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
    setOtpModal({
      open: true,
      participant,
      token: null,
      expiresAt: null,
      loading: true,
      error: null,
    });
    try {
      const res = await api.post(
        buildUrl(API_ENDPOINTS.CHECKIN_QR.GENERATE_PARTICIPANT_OTP, {
          participantId: participant.id,
        }),
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
      const msg =
        err?.response?.data?.message || err?.message || "Generate OTP failed";
      setOtpModal({
        open: true,
        participant,
        token: null,
        expiresAt: null,
        loading: false,
        error: String(msg),
      });
    }
  };

  const respondInvitation = async (
    participant: Participant,
    response: "ACCEPT" | "DECLINE",
  ) => {
    if (!participant?.id) return;
    setLoading(true);
    try {
      await api.put(
        buildUrl(API_ENDPOINTS.EVENTS.RESPOND_INVITATION, {
          participantId: participant.id,
        }),
        {
          response,
        },
      );
      setToast({
        type: "success",
        message:
          response === "ACCEPT"
            ? "Đã chấp nhận tham gia"
            : "Đã từ chối tham gia",
      });
      await loadEvent();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Respond failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const openCheckInModal = (participant: Participant) => {
    setCheckInModal({
      open: true,
      participant,
      otp: "",
      loading: false,
      error: null,
    });
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
      setCheckInModal({
        open: false,
        participant: null,
        otp: "",
        loading: false,
        error: null,
      });
      setToast({ type: "success", message: "Check-in thành công" });
      await loadEvent();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Check-in failed";
      setCheckInModal((prev) => ({
        ...prev,
        loading: false,
        error: String(msg),
      }));
    }
  };

  const requestRemoveParticipant = (participant: Participant) => {
    setPendingRemoveParticipant(participant);
  };

  const removeParticipant = async (participantId: string) => {
    if (!eventData?.id) return;
    setLoading(true);
    try {
      await api.delete(
        buildUrl(API_ENDPOINTS.EVENTS.REMOVE_PARTICIPANT, { participantId }),
      );
      setToast({ type: "success", message: "Participant removed" });
      await loadEvent();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Remove failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
      setPendingRemoveParticipant(null);
    }
  };

  const confirmRemoveParticipant = async () => {
    if (!pendingRemoveParticipant?.id) return;
    await removeParticipant(pendingRemoveParticipant.id);
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
      const msg =
        err?.response?.data?.message || err?.message || "Check-in failed";
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
  const buildingNode: any =
    (detail as any)?.building ?? (detail as any)?.reservation?.building ?? null;
  const floorNode: any =
    (detail as any)?.floor ?? (detail as any)?.reservation?.floor ?? null;
  const buildingName = buildingNode?.name ?? buildingNode?.buildingName ?? "";
  const buildingAddress = buildingNode?.address ?? buildingNode?.location ?? "";
  const floorName = floorNode?.name ?? floorNode?.floorName ?? "";
  const roomAddressText = [buildingAddress || buildingName, floorName, roomCode]
    .filter(Boolean)
    .join(" • ");
  const reservationStatus = String(
    (detail?.status as any) || (detail?.reservation as any)?.status || "",
  ).toUpperCase();
  const participants = eventData?.participants || [];
  const hasAnyCheckIn = participants.some(
    (p) => String(p.checkInStatus || "").toUpperCase() === "CHECKED_IN",
  );
  const canInvite =
    !hasAnyCheckIn &&
    reservationStatus !== "IN_USE" &&
    reservationStatus !== "CHECKED_IN";
  const selfParticipant = participants.find(
    (p) =>
      (p.email || "").trim().toLowerCase() &&
      (p.email || "").trim().toLowerCase() === currentUserEmail,
  );
  const canManageEvent = !selfParticipant;

  const loadLiveCode = async () => {
    if (!normalizedReservationId || !canManageEvent) return;
    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.CHECKIN_QR.GET_LIVE_CODE, {
          reservationId: normalizedReservationId,
        }),
      );
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
    if (
      canManageEvent &&
      normalizedReservationId &&
      reservationStatus === "IN_USE"
    ) {
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
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-slate-900">
                Manage Event
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Set up your event details, services, and invite participants
              </p>

              {/* Info Cards */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <MapPinIcon className="h-5 w-5 shrink-0 text-orange-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Room
                    </p>
                    <p className="truncate text-sm font-bold text-slate-900">
                      {roomCode || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <MapPinIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Address
                    </p>
                    <p className="text-sm font-bold text-slate-900 break-words whitespace-normal">
                      {roomAddressText || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3 sm:col-span-2">
                  <ClockIcon className="h-5 w-5 shrink-0 text-orange-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                      Time
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatDateTime24(reservationStart)} →{" "}
                      {formatDateTime24(reservationEnd)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Back button — orange, matches other screens */}
            <button
              type="button"
              disabled={loading}
              onClick={() => navigate(ROUTES.MY_BOOKINGS)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Event Info Section */}
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Event Information
              </h2>
            </div>

            <p className="mb-4 text-sm text-slate-600">
              Configure your event details and settings
            </p>

            <div className="space-y-4">
              {/* Event Title */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Event Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q1 Planning Session"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add event details..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>

              {/* Live Code Section */}
              {canManageEvent && reservationStatus === "IN_USE" && (
                <div className="mt-5 rounded-lg bg-orange-50 p-4 ring-1 ring-orange-200">
                  <p className="text-xs font-bold uppercase text-orange-600">
                    Live Check-in Code
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-orange-700">
                      {liveCode || "------"}
                    </span>
                    <span className="text-xs font-medium text-orange-500">
                      ({codeCountdown}s)
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-orange-600">
                    Share this 6-digit code with participants for check-in.
                    Refreshes every minute.
                  </p>
                </div>
              )}

              {canManageEvent &&
                reservationStatus !== "IN_USE" &&
                reservationStatus !== "COMPLETED" && (
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                    <p className="mb-3 text-sm text-slate-600">
                      Check-in to this booking first to generate the event code.
                    </p>
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
              <h2 className="text-lg font-bold text-slate-900">
                Services & Amenities
              </h2>
            </div>

            <p className="mb-4 text-sm text-slate-600">
              Add services for your event (microphone, desk, chairs, etc.)
            </p>

            {userStatusPay === "NO_PAY" && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <svg className="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-red-700">
                  You have an outstanding payment from a previous event. Please complete your payment at the lobby before ordering new services.
                </span>
              </div>
            )}

            <div className="space-y-3">
              {serviceItems.length ? (
                serviceItems.map((s) => {
                  const draft = serviceDraft[s.id] || {
                    quantity: "",
                    note: "",
                  };
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-slate-200 bg-white p-3.5 ring-1 ring-inset ring-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {s.name}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {s.price != null ? formatPriceVN(s.price) : "-"}{" "}
                            {s.unit ? `/${s.unit}` : ""}
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
                disabled={loading || userStatusPay === "NO_PAY"}
                onClick={saveServices}
                className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {userStatusPay === "NO_PAY" ? "Service Locked — Unpaid Bill" : "Save Services"}
              </button>
            </div>
          </div>
        </div>

        {/* Service Order Tracking Section */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setTrackingOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <QueueListIcon className="h-5 w-5 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">
                Service Order Tracking
              </h2>
              {serviceHistory.length > 0 && (
                <span className="rounded-full bg-slate-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  {serviceHistory.length}
                </span>
              )}
            </div>
            <svg
              className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${trackingOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20" fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {trackingOpen && (
          <div className="px-6 pb-6">
          <p className="mb-4 text-sm text-slate-500">
            All service requests and their current status.
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Service</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center w-16">Qty</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Note</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 w-40">Created At</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      No service orders yet.
                    </td>
                  </tr>
                ) : (
                  serviceHistory.map((line) => {
                    const st = (line.status || "").toUpperCase();
                    const statusCls =
                      st === "DONE" ? "bg-emerald-50 text-emerald-700"
                      : st === "CANCELLED" ? "bg-red-50 text-red-600"
                      : st === "IN_PROGRESS" ? "bg-blue-50 text-blue-700"
                      : st === "CONFIRMED" ? "bg-indigo-50 text-indigo-700"
                      : "bg-amber-50 text-amber-700";
                    const statusLabel =
                      st === "DONE" ? "Done"
                      : st === "CANCELLED" ? "Cancelled"
                      : st === "IN_PROGRESS" ? "In Progress"
                      : st === "CONFIRMED" ? "Confirmed"
                      : "Pending";
                    const fmtTime = (v?: string | null) => {
                      if (!v) return "-";
                      const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
                      return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { hour12: false });
                    };
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800">{line.name}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{line.quantity}</td>
                        <td className="px-4 py-3 text-slate-500">{line.note || "-"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{fmtTime(line.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
          )}
        </div>

        {/* Participants Section */}
        <div className="mt-6 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <UserGroupIcon className="h-6 w-6 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-900">Participants</h2>
          </div>

          <p className="mb-6 text-sm text-slate-600">
            Invite people by email and manage check-ins
          </p>

          {/* Invite Section */}
          {canManageEvent ? (
            <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Participant Email
                  </label>
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="participant@example.com"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100"
                    disabled={!canInvite}
                  />
                </div>
                <button
                  disabled={
                    loading ||
                    !inviteEmail.trim() ||
                    !canInvite
                  }
                  onClick={invite}
                  className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-60"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Invite
                </button>
              </div>
              {!canInvite && (
                <p className="mt-2 text-xs text-slate-500">
                  Cannot add participants after check-in has started.
                </p>
              )}
            </div>
          ) : null}

          {/* Self Participant Response */}
          {selfParticipant ? (
            <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-bold text-slate-900">
                Your Invitation Response
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Status:{" "}
                <span className="font-semibold text-slate-900">
                  {selfParticipant.inviteStatus || "-"}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {String(selfParticipant.inviteStatus || "").toUpperCase() ===
                "INVITED" ? (
                  <>
                    <button
                      disabled={loading}
                      onClick={() =>
                        respondInvitation(selfParticipant, "ACCEPT")
                      }
                      className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:flex-none"
                    >
                      Accept
                    </button>
                    <button
                      disabled={loading}
                      onClick={() =>
                        respondInvitation(selfParticipant, "DECLINE")
                      }
                      className="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 sm:flex-none"
                    >
                      Decline
                    </button>
                  </>
                ) : null}

                {String(selfParticipant.inviteStatus || "").toUpperCase() ===
                  "ACCEPTED" &&
                String(selfParticipant.checkInStatus || "").toUpperCase() !==
                  "CHECKED_IN" ? (
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
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">
                    Invite
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-slate-600">
                    Check-in
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventData?.participants?.length ? (
                  eventData.participants.map((p) => (
                    <tr key={p.id} className="transition hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {p.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {p.fullName || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            String(p.inviteStatus || "").toUpperCase() ===
                            "ACCEPTED"
                              ? "bg-orange-50 text-orange-700"
                              : String(p.inviteStatus || "").toUpperCase() ===
                                  "DECLINED"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.inviteStatus || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                              String(p.checkInStatus || "").toUpperCase() ===
                              "CHECKED_IN"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {String(p.checkInStatus || "").toUpperCase() ===
                            "CHECKED_IN"
                              ? "Checked In"
                              : String(p.checkInStatus || "").toUpperCase() ===
                                  "NOT_CHECKED_IN"
                                ? "Not Checked In"
                                : p.checkInStatus || "—"}
                          </span>
                          {p.checkInTime && (
                            <span className="text-xs text-slate-400">
                              {new Date(p.checkInTime).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1.5">
                          <button
                            disabled={loading}
                            onClick={() => openHistory(p)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                          >
                            History
                          </button>

                          {canManageEvent &&
                          (p.checkInStatus || "").toUpperCase() !== "CHECKED_IN" ? (
                            <button
                              disabled={loading}
                              onClick={() => requestRemoveParticipant(p)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
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
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
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
                <div className="text-lg font-bold text-slate-900">
                  Status History
                </div>
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
                <div className="text-sm text-red-600">
                  {participantHistoryModal.error}
                </div>
              ) : participantHistoryModal.items.length ? (
                <div className="space-y-3">
                  {participantHistoryModal.items.map((h) => {
                    const inviteFrom = h.fromInviteStatus || "-";
                    const inviteTo = h.toInviteStatus || "-";
                    const checkFrom = h.fromCheckInStatus || "-";
                    const checkTo = h.toCheckInStatus || "-";
                    return (
                      <div
                        key={h.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {h.action || "Update"}
                          </div>
                          <div className="text-xs font-medium text-slate-500">
                            {formatHistoryTime(h.changedAt)}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase text-slate-500">
                              Invite Status
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                              <span className="rounded-full bg-slate-200 px-2 py-0.5">
                                {inviteFrom}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">
                                {inviteTo}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase text-slate-500">
                              Check-in Status
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                              <span className="rounded-full bg-slate-200 px-2 py-0.5">
                                {checkFrom}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                {checkTo}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                            By {h.changedByEmail || "System"}
                          </span>
                          {h.note ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                              Note: {h.note}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
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
                <div className="text-lg font-bold text-slate-900">
                  OTP Check-in
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {otpModal.participant?.email || "-"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setOtpModal({
                    open: false,
                    participant: null,
                    token: null,
                    expiresAt: null,
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
              {otpModal.loading ? (
                <div className="text-sm text-slate-500">Generating...</div>
              ) : otpModal.error ? (
                <div className="text-sm text-red-600">{otpModal.error}</div>
              ) : otpModal.token ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">
                    OTP
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-widest text-slate-900">
                    {otpModal.token}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Expires at:{" "}
                    <span className="font-semibold">
                      {otpModal.expiresAt || "-"}
                    </span>
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
                <div className="mt-1 text-sm text-slate-600">
                  {checkInModal.participant?.email || "-"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCheckInModal({
                    open: false,
                    participant: null,
                    otp: "",
                    loading: false,
                    error: null,
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={checkInModal.otp}
                onChange={(e) =>
                  setCheckInModal((prev) => ({ ...prev, otp: e.target.value }))
                }
                placeholder="Enter OTP..."
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
                Confirm Check-in
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!pendingRemoveParticipant}
        tone="danger"
        title="Remove participant"
        description={
          pendingRemoveParticipant
            ? `Remove ${pendingRemoveParticipant.email || pendingRemoveParticipant.fullName || "this participant"} from the event?`
            : "Remove this participant from the event?"
        }
        confirmText="Remove"
        cancelText="Keep"
        loading={loading}
        onClose={() => setPendingRemoveParticipant(null)}
        onConfirm={confirmRemoveParticipant}
      />

      {toast ? (
        <CustomMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
};

export default EventSetupPage;
// end+ chức năng đặt phòng theo sự kiện (trang setup tiện ích/dịch vụ + participants)
