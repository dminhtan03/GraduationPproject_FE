import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { api } from "../services/api";
import { reservationService } from "../services/reservationService";
import { API_ENDPOINTS, buildUrl } from "../constants/endpoints";
import { ROUTES } from "../constants";
import { logout } from "../services/authService";
import type { MessageType } from "../components/common/CustomMessage";
import {
  Amenity,
  EventData,
  ReservationDetail,
  ServiceLine,
  ServiceStatus,
  SummaryRow,
} from "../types/adminEventBooking";
import { ACTIVE_STATUSES, HISTORY_STATUSES, statusConfig } from "../constants/adminEventBooking";
import { getErrorMessage, normalizeSockJsUrl } from "../utils/adminEventBookingUtils";

export const useAdminEventBookingDetail = () => {
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
  const [cancelModal, setCancelModal] = useState<{
    item: ServiceLine;
    reason: string;
  } | null>(null);

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

  const handleUpdateStatus = (item: ServiceLine, newStatus: string) => {
    if (newStatus === "CANCELLED") {
      setCancelModal({ item, reason: "" });
    } else {
      doUpdateStatus(item, newStatus);
    }
  };

  const confirmCancel = async () => {
    if (!cancelModal) return;
    if (!cancelModal.reason.trim()) {
      setToast({
        type: "warning",
        message: "Please provide a reason for cancellation.",
      });
      return;
    }
    await doUpdateStatus(cancelModal.item, "CANCELLED", cancelModal.reason);
    setCancelModal(null);
  };

  const allServiceLines: ServiceLine[] = useMemo(() => {
    const raw = detail?.serviceItems ?? detail?.reservation?.serviceItems ?? [];
    return Array.isArray(raw) ? (raw as ServiceLine[]) : [];
  }, [detail]);

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
      allServiceLines.filter((l) =>
        HISTORY_STATUSES.includes(
          (l.status || "PENDING").toUpperCase() as ServiceStatus,
        ),
      ),
    [allServiceLines],
  );

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

  return {
    navigate,
    detail,
    eventData,
    loading,
    adminName,
    adminEmail,
    toast,
    setToast,
    updatingStatus,
    cancelModal,
    setCancelModal,
    handleUpdateStatus,
    confirmCancel,
    activeLines,
    historyLines,
    summaryRows,
    amenities,
    roomCode,
    handleLogout,
    startTime,
    endTime,
  };
};
