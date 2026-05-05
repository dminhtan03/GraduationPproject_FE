import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Typography,
  Empty,
  Table,
  Tag,
  Tabs,
  Modal,
  Select,
  Input,
  InputNumber,
  Rate,
  Alert,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table";
import { CalendarOutlined } from "@ant-design/icons";
import {
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  SparklesIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
// start add authService import
import { getProfile } from "../../services/authService";
import { adminService } from "../../services/adminService";
import type { UserProfile } from "../../types";
// end add authService import
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { feedbackService } from "../../services/feedbackService";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { Reservation, WebSocketMessage } from "../../types";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { CustomPagination } from "../../components/common";
import { useWebSocket } from "../../hooks/useWebSocket";
import DatePickerField from "../../components/common/DatePickerField";
import TimeSelectField from "../../components/common/TimeSelectField";
import { buildDateTime } from "../../utils";

const { Title, Paragraph } = Typography;

type BookingTabKey = "history" | "ongoing" | "invitations" | "meeting-with-event";
type BookingActionType = "check-in" | "return-room" | "extend" | "cancel";

interface BookingActionModalState {
  type: BookingActionType;
  booking: Reservation;
}

interface FeedbackModalState {
  reservationId: string;
  booking: Reservation;
}

interface ReservationRealtimePayload {
  reservationId: string;
  newStatus: string;
}

interface BuildingFilterOption {
  value: string;
  label: string;
}

interface FloorFilterOption {
  value: string;
  label: string;
}

type EventInvitation = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  inviteStatus?: string | null;
  checkInStatus?: string | null;
  checkInTime?: string | null;
  eventId?: string | null;
  reservationId?: string | null;
  eventTitle?: string | null;
  reservationStartTime?: string | null;
  reservationEndTime?: string | null;
  roomLocationCode?: string | null;
  roomAddress?: string | null;
};

const normalizeBuildingOptions = (payload: unknown): BuildingFilterOption[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? ((payload as { data?: unknown[] }).data as unknown[])
      : [];

  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const value =
        (raw.id != null ? String(raw.id) : "") ||
        (raw.buildingId != null ? String(raw.buildingId) : "");
      const label =
        (typeof raw.name === "string" ? raw.name : "") ||
        (typeof raw.buildingName === "string" ? raw.buildingName : "");

      if (!value || !label) return null;
      return { value, label };
    })
    .filter((item): item is BuildingFilterOption => !!item);
};

const normalizeFloorOptions = (payload: unknown): FloorFilterOption[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? ((payload as { data?: unknown[] }).data as unknown[])
      : [];

  const parseFloorNumber = (text: string) => {
    const matched = text.match(/(\d+)/);
    if (!matched) return null;
    const value = Number(matched[1]);
    return Number.isFinite(value) ? value : null;
  };

  const mapped = list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const value =
        (raw.id != null ? String(raw.id) : "") ||
        (raw.floorId != null ? String(raw.floorId) : "");
      const label =
        (typeof raw.name === "string" ? raw.name : "") ||
        (typeof raw.floorName === "string" ? raw.floorName : "");

      if (!value || !label) return null;
      const floorNumber = parseFloorNumber(label);
      if (floorNumber != null && floorNumber >= 1 && floorNumber <= 5) {
        return {
          value,
          label: `Tầng ${floorNumber}`,
          floorNumber,
        };
      }

      return {
        value,
        label,
        floorNumber: null,
      };
    })
    .filter(
      (
        item,
      ): item is FloorFilterOption & {
        floorNumber: number | null;
      } => !!item,
    );

  const unique = Array.from(
    new Map(
      mapped.map((item) => [
        item.floorNumber != null
          ? `num-${item.floorNumber}`
          : `value-${item.value}`,
        item,
      ]),
    ).values(),
  );

  return unique
    .sort((left, right) => {
      if (left.floorNumber != null && right.floorNumber != null) {
        return left.floorNumber - right.floorNumber;
      }
      if (left.floorNumber != null) return -1;
      if (right.floorNumber != null) return 1;
      return left.label.localeCompare(right.label);
    })
    .map(({ value, label }) => ({ value, label }));
};

const TAB_STATUS_FILTERS: Record<BookingTabKey, string[]> = {
  ongoing: ["RESERVED", "IN_USE"],
  history: ["NO_SHOW", "CANCELLED", "COMPLETED", "FORCE_CANCELLED", "FAILED"],
  invitations: [],
  "meeting-with-event": ["RESERVED", "IN_USE", "NO_SHOW", "CANCELLED", "COMPLETED", "FORCE_CANCELLED", "FAILED"],
};

const isEventBooking = (item: Reservation): boolean => {
  // Check if booking type is EVENT from backend
  return (item.bookingType || "").toUpperCase() === "EVENT";
};

const filterItemsByTab = (items: Reservation[], tabKey: BookingTabKey, eventInvitations: EventInvitation[] = []) => {
  const allowedStatuses = [
    ...TAB_STATUS_FILTERS.ongoing,
    ...TAB_STATUS_FILTERS.history,
  ];

  if (tabKey === "meeting-with-event") {
    return items.filter((item) => {
      const status = (item.status || "").toUpperCase();
      const isEvent = isEventBooking(item);
      const hasValidStatus = TAB_STATUS_FILTERS["meeting-with-event"].includes(status);
      return isEvent && hasValidStatus;
    });
  }

  if (tabKey === "history") {
    return items.filter((item) => {
      const status = (item.status || "").toUpperCase();
      return TAB_STATUS_FILTERS.history.includes(status);
    });
  }

  return items.filter((item) => {
    const status = (item.status || "").toUpperCase();
    // Only show Normal bookings in ongoing tab (exclude Event bookings)
    const isNormalBooking = !isEventBooking(item);
    return (
      isNormalBooking && (
        TAB_STATUS_FILTERS.ongoing.includes(status) ||
        !allowedStatuses.includes(status)
      )
    );
  });
};

const parseBookingDateTime = (value?: string) => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const date = parseBookingDateTime(value);
  if (!date) return value;
  return date.toLocaleString([], { hour12: false });
};

const formatDatePart = (value?: string) => {
  const date = parseBookingDateTime(value);
  if (!date) return "-";
  return date.toLocaleDateString();
};

const formatTimePart = (value?: string) => {
  const date = parseBookingDateTime(value);
  if (!date) return "-";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const splitTimeValue = (
  value: string,
  fallbackHour: string,
  fallbackMinute: string,
) => {
  const [hour, minute] = value.split(":");
  return {
    hour: hour || fallbackHour,
    minute: minute || fallbackMinute,
  };
};

const extractBackendSuccessMessage = (
  response: unknown,
  fallback: string,
): string => {
  if (!response || typeof response !== "object") return fallback;

  const wrapped = response as {
    data?: {
      meta?: { message?: string };
      message?: string;
      data?: unknown;
    };
  };

  const payload = wrapped.data;
  if (!payload) return fallback;

  if (
    typeof payload.meta?.message === "string" &&
    payload.meta.message.trim()
  ) {
    return payload.meta.message;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.data === "string" && payload.data.trim()) {
    return payload.data;
  }

  if (
    payload.data &&
    typeof payload.data === "object" &&
    typeof (payload.data as { message?: string }).message === "string" &&
    (payload.data as { message?: string }).message?.trim()
  ) {
    return (payload.data as { message?: string }).message || fallback;
  }

  return fallback;
};

const extractBackendFailureMessage = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;

  const wrapped = response as {
    success?: boolean;
    data?: {
      success?: boolean;
      meta?: { message?: string; status?: number };
      message?: string;
      status?: number;
      data?: { success?: boolean; message?: string; status?: number } | string;
    };
  };

  const payload = wrapped.data;
  const hardFailed =
    wrapped.success === false ||
    payload?.success === false ||
    (payload?.data &&
      typeof payload.data === "object" &&
      payload.data.success === false);

  const hasErrorStatus =
    (typeof payload?.status === "number" && payload.status >= 400) ||
    (typeof payload?.meta?.status === "number" && payload.meta.status >= 400) ||
    (payload?.data &&
      typeof payload.data === "object" &&
      typeof payload.data.status === "number" &&
      payload.data.status >= 400);

  const candidateMessages: string[] = [];
  if (
    typeof payload?.meta?.message === "string" &&
    payload.meta.message.trim()
  ) {
    candidateMessages.push(payload.meta.message.trim());
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    candidateMessages.push(payload.message.trim());
  }
  if (typeof payload?.data === "string" && payload.data.trim()) {
    candidateMessages.push(payload.data.trim());
  }
  if (
    payload?.data &&
    typeof payload.data === "object" &&
    typeof payload.data.message === "string" &&
    payload.data.message.trim()
  ) {
    candidateMessages.push(payload.data.message.trim());
  }

  const hasFailureKeyword = candidateMessages.some((msg) => {
    const normalized = msg.toLowerCase();
    return (
      normalized.includes("fail") ||
      normalized.includes("error") ||
      normalized.includes("cannot") ||
      normalized.includes("can't") ||
      normalized.includes("not allowed") ||
      normalized.includes("already") ||
      normalized.includes("overlap") ||
      normalized.includes("booked") ||
      normalized.includes("khong") ||
      normalized.includes("không") ||
      normalized.includes("khong the") ||
      normalized.includes("không thể") ||
      normalized.includes("trung") ||
      normalized.includes("trùng")
    );
  });

  if (!hardFailed && !hasErrorStatus && !hasFailureKeyword) return null;

  if (candidateMessages.length > 0) return candidateMessages[0];

  return "Không thể gia hạn phòng";
};

const getStatusColor = (status: string) => {
  const normalized = status.toUpperCase();
  // if (normalized === "PENDING") return "gold";
  if (normalized === "RESERVED") return "green";
  if (normalized === "IN_USE" || normalized === "CHECKED_IN") return "blue";
  if (normalized === "COMPLETED") return "cyan";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "FORCE_CANCELLED") return "volcano";
  if (normalized === "NO_SHOW") return "orange";
  if (normalized === "FAILED") return "magenta";
  return "default";
};

const isValidDate = (value?: string) => {
  return parseBookingDateTime(value) !== null;
};

// start update helper functions to accept now parameter
const canCheckIn = (
  status: string,
  startTime?: string,
  endTime?: string,
  now: Date = new Date(),
) => {
  const normalized = status.toUpperCase();
  if (
    [
      "IN_USE",
      "CHECKED_IN",
      "CANCELLED",
      "COMPLETED",
      "REJECTED",
      "NO_SHOW",
    ].includes(normalized)
  ) {
    return false;
  }
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);

  if (!start || !end) return false;
  return now >= start && now <= end;
};

const canCheckOut = (
  status: string,
  startTime?: string,
  endTime?: string,
  now: Date = new Date(),
) => {
  const normalized = status.toUpperCase();
  if (!["IN_USE", "CHECKED_IN"].includes(normalized)) return false;
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);
  if (!start || !end) return false;

  return now >= start && now <= end;
};

const canExtend = (
  status: string,
  startTime?: string,
  endTime?: string,
  now: Date = new Date(),
) => {
  const normalized = status.toUpperCase();
  if (!["RESERVED", "IN_USE", "CHECKED_IN"].includes(normalized)) return false;
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);
  if (!start || !end) return false;

  // For RESERVED: allow extend before booking ends
  if (normalized === "RESERVED") {
    return now < end;
  }
  // For IN_USE/CHECKED_IN: allow extend during booking
  return now >= start && now <= end;
};

const canCancel = (
  status: string,
  startTime?: string,
  endTime?: string,
  now: Date = new Date(),
) => {
  const normalized = status.toUpperCase();
  if (
    [
      "IN_USE",
      "CHECKED_IN",
      "CANCELLED",
      "COMPLETED",
      "REJECTED",
      "NO_SHOW",
    ].includes(normalized)
  ) {
    return false;
  }

  if (!normalized || !["RESERVED", "APPROVED"].includes(normalized)) {
    return false;
  }

  const start = parseBookingDateTime(startTime);
  if (!start) return false;

  const end = parseBookingDateTime(endTime);
  if (end) return now <= end;

  return true;
};
// end update helper functions

const getReservationRealtimePayload = (
  message: WebSocketMessage | null,
): ReservationRealtimePayload | null => {
  if (!message || message.type !== "update") {
    return null;
  }

  const raw = message.data;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Record<string, unknown>;
  const reservationId = String(payload.reservationId || "").trim();
  const newStatus = String(payload.newStatus || "").trim();

  if (!reservationId || !newStatus) {
    return null;
  }

  return { reservationId, newStatus };
};

const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { lastMessage } = useWebSocket();
  const [activeTab, setActiveTab] = useState<BookingTabKey>("ongoing");
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionModal, setActionModal] =
    useState<BookingActionModalState | null>(null);
  const [actionModalError, setActionModalError] = useState<string | null>(null);
  const [extendHour, setExtendHour] = useState<number>(1);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState | null>(
    null,
  );
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackDescription, setFeedbackDescription] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<
    BuildingFilterOption[]
  >([]);
  const [floorOptions, setFloorOptions] = useState<FloorFilterOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [locationCodeFilter, setLocationCodeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [startHourFilter, setStartHourFilter] = useState<string>("00");
  const [startMinuteFilter, setStartMinuteFilter] = useState<string>("00");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [endHourFilter, setEndHourFilter] = useState<string>("23");
  const [endMinuteFilter, setEndMinuteFilter] = useState<string>("59");
  const [appliedBuildingId, setAppliedBuildingId] = useState<string>("all");
  const [appliedFloorId, setAppliedFloorId] = useState<string>("all");
  const [appliedLocationCode, setAppliedLocationCode] = useState<string>("");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<string>("all");
  const [appliedStartTimeFilter, setAppliedStartTimeFilter] =
    useState<string>("");
  const [appliedEndTimeFilter, setAppliedEndTimeFilter] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");

  // start add currentTime state for auto-enabling buttons
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Update every 10 seconds
    return () => clearInterval(timer);
  }, []);
  // end add currentTime state

  // start add userProfile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await getProfile();
      const responseData = response.data as unknown;
      let userData: unknown = responseData;

      if (
        responseData &&
        typeof responseData === "object" &&
        "data" in responseData
      ) {
        userData = (responseData as { data?: unknown }).data;
      }

      setUserProfile((userData as UserProfile) || null);
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);
  // end add userProfile state

  useEffect(() => {
    const loadBuildings = async () => {
      try {
        const response = await adminService.getAllBuildings();
        const options = normalizeBuildingOptions(response);
        setBuildingOptions(options);
      } catch {
        setBuildingOptions([]);
      }
    };

    void loadBuildings();
  }, []);

  useEffect(() => {
    const loadFloors = async () => {
      if (!selectedBuildingId || selectedBuildingId === "all") {
        setFloorOptions([]);
        setSelectedFloorId("all");
        return;
      }

      try {
        const response =
          await adminService.getFloorsByBuilding(selectedBuildingId);
        const options = normalizeFloorOptions(response);
        setFloorOptions(options);
        setSelectedFloorId("all");
      } catch {
        setFloorOptions([]);
        setSelectedFloorId("all");
      }
    };

    void loadFloors();
  }, [selectedBuildingId]);

  const showToast = (type: MessageType, nextMessage: string) => {
    setToastPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setToastPopup((current) =>
        current && current.message === nextMessage ? null : current,
      );
    }, 3000);
  };

  useEffect(() => {
    if (error) showToast("error", error);
  }, [error]);

  useEffect(() => {
    if (invitationsError) showToast("error", invitationsError);
  }, [invitationsError]);

  const loadBookings = useCallback(
    async (
      nextPage: number,
      nextSize: number,
      tabKey: BookingTabKey,
      buildingId: string,
      floorId: string,
      locationCode: string,
      statusValue: string,
      startTimeValue: string,
      endTimeValue: string,
      eventInvitations: EventInvitation[] = [],
    ) => {
      setLoading(true);
      setError(null);
      setBookings([]); // Clear old data immediately to prevent showing stale records
      
      // Invitations tab handled separately via loadInvitations()
      if (tabKey === "invitations") {
        setLoading(false);
        return;
      }
      
      try {
        const selectedBuilding =
          buildingId !== "all"
            ? buildingOptions.find((item) => item.value === buildingId)
            : null;
        const selectedFloor =
          floorId !== "all"
            ? floorOptions.find((item) => item.value === floorId)
            : null;

        const normalizedStatus = statusValue.trim().toUpperCase();
        const requestedStatuses =
          normalizedStatus && normalizedStatus !== "ALL"
            ? [normalizedStatus]
            : TAB_STATUS_FILTERS[tabKey];

        // Use backend pagination
        try {
          const result = await reservationService.getMyBookings({
            page: Math.max(nextPage - 1, 0),
            size: nextSize,
            statuses: requestedStatuses,
            buildingId: buildingId !== "all" ? buildingId : undefined,
            locationCode: locationCode.trim() || undefined,
            startTime: startTimeValue || undefined,
            endTime: endTimeValue || undefined,
          });
          
          setBookings(result.items);
          setTotal(result.total);
        } catch (err) {
          // Fallback: fetch all data for client-side filtering if needed
          const fallbackPageSize = 9999;
          try {
            const fallbackResult = await reservationService.getMyBookings({
              page: 0,
              size: fallbackPageSize,
              statuses: requestedStatuses,
              buildingId: buildingId !== "all" ? buildingId : undefined,
              locationCode: locationCode.trim() || undefined,
              startTime: startTimeValue || undefined,
              endTime: endTimeValue || undefined,
            });
            
            let allItems = fallbackResult.items;
            
            // Apply time range filter if specified
            if (startTimeValue && endTimeValue) {
              const start = parseBookingDateTime(startTimeValue);
              const end = parseBookingDateTime(endTimeValue);
              if (start && end) {
                allItems = allItems.filter((item) => {
                  const itemStart = parseBookingDateTime(item.startTime);
                  if (!itemStart) return false;
                  return itemStart >= start && itemStart <= end;
                });
              }
            }
            
            // Manual pagination for fallback
            const startIndex = (nextPage - 1) * nextSize;
            const paged = allItems.slice(startIndex, startIndex + nextSize);
            setBookings(paged);
            setTotal(allItems.length);
          } catch {
            throw err;
          }
        }
      } catch (err) {
        setError(extractApiMessage(err, "Unable to load bookings"));
        setBookings([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [buildingOptions, floorOptions, invitations],
  );

  useEffect(() => {
    if (activeTab === "invitations") return;
    loadBookings(
      page,
      pageSize,
      activeTab,
      appliedBuildingId,
      appliedFloorId,
      appliedLocationCode,
      appliedStatusFilter,
      appliedStartTimeFilter,
      appliedEndTimeFilter,
      invitations,
    );
  }, [
    loadBookings,
    page,
    pageSize,
    activeTab,
    appliedBuildingId,
    appliedFloorId,
    appliedLocationCode,
    appliedStatusFilter,
    appliedStartTimeFilter,
    appliedEndTimeFilter,
  ]);

  const loadInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    setInvitationsError(null);
    try {
      const res = await api.get(API_ENDPOINTS.EVENTS.MY_INVITATIONS);
      const responseData = res.data as unknown;
      let payload: unknown = responseData;

      if (
        responseData &&
        typeof responseData === "object" &&
        "data" in responseData
      ) {
        payload = (responseData as { data?: unknown }).data;
      }

      setInvitations(
        Array.isArray(payload) ? (payload as EventInvitation[]) : [],
      );
    } catch (err) {
      setInvitationsError(extractApiMessage(err, "Unable to load invitations"));
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  }, []);

  const respondInvitation = useCallback(
    async (participantId: string, response: "ACCEPT" | "DECLINE") => {
      if (!participantId) return;
      setInvitationsLoading(true);
      try {
        await api.put(
          buildUrl(API_ENDPOINTS.EVENTS.RESPOND_INVITATION, { participantId }),
          { response },
        );
        showToast(
          "success",
          response === "ACCEPT"
            ? "Đã chấp nhận tham gia"
            : "Đã từ chối tham gia",
        );
        await loadInvitations();
      } catch (err) {
        showToast(
          "error",
          extractApiMessage(err, "Unable to respond invitation"),
        );
      } finally {
        setInvitationsLoading(false);
      }
    },
    [loadInvitations],
  );

  useEffect(() => {
    const realtimePayload = getReservationRealtimePayload(lastMessage);
    if (!realtimePayload) {
      return;
    }
    if (activeTab === "invitations") return;

    const normalizedStatus = realtimePayload.newStatus.toUpperCase();

    console.log("[MyBookings] Realtime reservation update received:", {
      rawMessage: lastMessage,
      reservationId: realtimePayload.reservationId,
      newStatus: normalizedStatus,
      activeTab,
      currentPage: page,
      currentPageSize: pageSize,
    });

    setBookings((prev) => {
      const hasUpdatedBooking = prev.some(
        (item) => String(item.id || "") === realtimePayload.reservationId,
      );

      console.log("[MyBookings] Reservation exists in current table:", {
        reservationId: realtimePayload.reservationId,
        hasUpdatedBooking,
        currentBookingIds: prev.map((item) => item.id),
      });

      if (!hasUpdatedBooking) {
        return prev;
      }

      const updatedItems = prev.map((item) =>
        String(item.id || "") === realtimePayload.reservationId
          ? { ...item, status: normalizedStatus }
          : item,
      );

      console.log(
        "[MyBookings] Bookings after local status patch:",
        updatedItems,
      );

      return filterItemsByTab(updatedItems, activeTab, invitations);
    });

    console.log(
      "[MyBookings] Triggering background reload after realtime update",
    );
    void loadBookings(
      page,
      pageSize,
      activeTab,
      appliedBuildingId,
      appliedFloorId,
      appliedLocationCode,
      appliedStatusFilter,
      appliedStartTimeFilter,
      appliedEndTimeFilter,
      invitations,
    );
  }, [
    activeTab,
    appliedBuildingId,
    appliedFloorId,
    appliedLocationCode,
    appliedStatusFilter,
    appliedStartTimeFilter,
    appliedEndTimeFilter,
    lastMessage,
    loadBookings,
    page,
    pageSize,
    invitations,
  ]);

  const openActionModal = (type: BookingActionType, booking: Reservation) => {
    setActionModalError(null);
    if (type === "extend") {
      setExtendHour(1);
    }
    if (type === "cancel") {
      setCancelReason("");
    }
    setActionModal({ type, booking });
  };

  const closeActionModal = () => {
    setActionModalError(null);
    setCancelReason("");
    setActionModal(null);
  };

  const openFeedbackModal = (booking: Reservation) => {
    if (!booking.id) return;
    setFeedbackRating(5);
    setFeedbackDescription("");
    setFeedbackModal({ reservationId: booking.id, booking });
  };

  const closeFeedbackModal = () => {
    if (submittingFeedback) return;
    setFeedbackModal(null);
    setFeedbackRating(5);
    setFeedbackDescription("");
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal?.reservationId) return;
    if (feedbackDescription.trim().length === 0) {
      showToast(
        "warning",
        "Please enter your feedback (at least 1 character).",
      );
      return;
    }

    setSubmittingFeedback(true);
    try {
      const response = await feedbackService.createFeedback({
        reservationId: feedbackModal.reservationId,
        rating: feedbackRating,
        description: feedbackDescription.trim(),
      });

      const successMessage = extractBackendSuccessMessage(
        response,
        "Feedback created successfully",
      );
      showToast("success", successMessage);
      closeFeedbackModal();
      await loadBookings(
        page,
        pageSize,
        activeTab,
        appliedBuildingId,
        appliedFloorId,
        appliedLocationCode,
        appliedStatusFilter,
        appliedStartTimeFilter,
        appliedEndTimeFilter,
        invitations,
      );
    } catch (err) {
      showToast("error", extractApiMessage(err, "Unable to submit feedback"));
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionModal?.booking?.id) return;

    setActionModalError(null);

    const currentAction = actionModal;

    const reservationId = String(currentAction.booking.id);
    const status = currentAction.booking.status || "";
    // Use currentTime state for validation
    const now = currentTime;

    if (
      currentAction.type === "check-in" &&
      !canCheckIn(
        status,
        currentAction.booking.startTime,
        currentAction.booking.endTime,
        now,
      )
    ) {
      showToast("warning", "You can only check-in during the booked time.");
      return;
    }

    if (
      currentAction.type === "return-room" &&
      !canCheckOut(
        status,
        currentAction.booking.startTime,
        currentAction.booking.endTime,
        now,
      )
    ) {
      showToast(
        "warning",
        "You can only return the room while the meeting is in progress.",
      );
      return;
    }

    if (
      currentAction.type === "extend" &&
      !canExtend(
        status,
        currentAction.booking.startTime,
        currentAction.booking.endTime,
        now,
      )
    ) {
      showToast(
        "warning",
        "You can only extend the time while the meeting is in progress.",
      );
      return;
    }

    if (
      currentAction.type === "cancel" &&
      !canCancel(
        status,
        currentAction.booking.startTime,
        currentAction.booking.endTime,
        now,
      )
    ) {
      showToast(
        "warning",
        "You can only cancel the booking before the meeting starts.",
      );
      return;
    }

    if (currentAction.type === "cancel" && cancelReason.trim().length < 2) {
      showToast("error", "Reason must be at least 2 characters");
      return;
    }

    setLoading(true);
    setActionLoadingId(reservationId);
    try {
      let actionResponse: unknown;

      if (currentAction.type === "check-in") {
        actionResponse = await reservationService.checkInBooking(reservationId);
      } else if (currentAction.type === "return-room") {
        actionResponse =
          await reservationService.returnRoomBooking(reservationId);
      } else if (currentAction.type === "extend") {
        actionResponse = await reservationService.extendRoomBooking(
          reservationId,
          extendHour,
        );

        const extendFailure = extractBackendFailureMessage(actionResponse);
        if (extendFailure) {
          throw { message: extendFailure, status: 400 };
        }
      } else {
        actionResponse = await reservationService.cancelBooking(
          reservationId,
          cancelReason.trim(),
        );
      }

      const actionSuccessFallback =
        currentAction.type === "check-in"
          ? "Check-in completed successfully"
          : currentAction.type === "return-room"
            ? "Return room completed successfully"
            : currentAction.type === "extend"
              ? "Extend room completed successfully"
              : "Cancel booking completed successfully";

      const successMessage =
        currentAction.type === "check-in" || currentAction.type === "return-room"
          ? actionSuccessFallback
          : extractBackendSuccessMessage(actionResponse, actionSuccessFallback);

      showToast(
        "success",
        successMessage,
      );

      // start update profile after cancellation
      if (currentAction.type === "cancel") {
        void fetchUserProfile();
      }
      // end update profile after cancellation

      closeActionModal();
      if (currentAction.type === "return-room") {
        openFeedbackModal(currentAction.booking);
      }
      await loadBookings(
        page,
        pageSize,
        activeTab,
        appliedBuildingId,
        appliedFloorId,
        appliedLocationCode,
        appliedStatusFilter,
        appliedStartTimeFilter,
        appliedEndTimeFilter,
        invitations,
      );
    } catch (err) {
      const actionErrorMessage = extractApiMessage(
        err,
        currentAction.type === "check-in"
          ? "Unable to check-in booking"
          : currentAction.type === "return-room"
            ? "Unable to return room"
            : currentAction.type === "extend"
              ? "Unable to extend room"
              : "Unable to cancel booking",
      );
      setActionModalError(actionErrorMessage);
      showToast("error", actionErrorMessage);
    } finally {
      setLoading(false);
      setActionLoadingId(null);
    }
  };

  const handleTabChange = (key: string) => {
    const nextTab = key as BookingTabKey;
    setActiveTab(nextTab);
    setPage(1);
    handleClearStartTimeSearch();
    // Load data immediately with new tab to avoid showing old data
    window.setTimeout(() => {
      if (nextTab === "invitations") {
        void loadInvitations();
        return;
      }
      loadBookings(1, pageSize, nextTab, "all", "all", "", "all", "", "", invitations);
    }, 0);
  };

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: unknown,
    _sorter: unknown,
    extra: { action?: string },
  ) => {
    if (activeTab === "invitations") return;

    const nextPage = pagination.current || 1;
    const nextSize = pagination.pageSize || pageSize;

    // If pageSize changed, reset to page 1
    if (nextSize !== pageSize) {
      loadBookings(
        1,
        nextSize,
        activeTab,
        appliedBuildingId,
        appliedFloorId,
        appliedLocationCode,
        appliedStatusFilter,
        appliedStartTimeFilter,
        appliedEndTimeFilter,
        invitations,
      );
      return;
    }

    // Handle pagination (page change)
    if (extra?.action && extra.action !== "paginate") {
      return;
    }

    loadBookings(
      nextPage,
      nextSize,
      activeTab,
      appliedBuildingId,
      appliedFloorId,
      appliedLocationCode,
      appliedStatusFilter,
      appliedStartTimeFilter,
      appliedEndTimeFilter,
      invitations,
    );
  };

  const handleBuildingFilterChange = (value: string) => {
    setSelectedBuildingId(value);
  };

  const handleFloorFilterChange = (value: string) => {
    setSelectedFloorId(value);
  };

  const statusSearchOptions = useMemo(
    () => [
      { value: "all", label: "All status" },
      ...TAB_STATUS_FILTERS[activeTab].map((item) => ({
        value: item,
        label: item,
      })),
    ],
    [activeTab],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [pageSize, total],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (activeTab === "invitations") return;
      if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
      loadBookings(
        nextPage,
        pageSize,
        activeTab,
        appliedBuildingId,
        appliedFloorId,
        appliedLocationCode,
        appliedStatusFilter,
        appliedStartTimeFilter,
        appliedEndTimeFilter,
        invitations,
      );
    },
    [
      activeTab,
      appliedBuildingId,
      appliedFloorId,
      appliedLocationCode,
      appliedStatusFilter,
      appliedStartTimeFilter,
      appliedEndTimeFilter,
      loadBookings,
      page,
      pageSize,
      totalPages,
      invitations,
    ],
  );

  useEffect(() => {
    if (activeTab === "invitations") return;
    if (page > totalPages) {
      handlePageChange(totalPages);
    }
  }, [activeTab, handlePageChange, page, totalPages]);

  const handleApplyFilters = () => {
    const normalizedStart = startDateFilter
      ? buildDateTime(startDateFilter, startHourFilter, startMinuteFilter)
      : "";
    const normalizedEnd = endDateFilter
      ? buildDateTime(endDateFilter, endHourFilter, endMinuteFilter)
      : "";

    if (
      (normalizedStart && !normalizedEnd) ||
      (!normalizedStart && normalizedEnd)
    ) {
      showToast(
        "warning",
        "Please provide both Start time and End time to filter by time.",
      );
      return;
    }

    if (normalizedStart && normalizedEnd) {
      const start = parseBookingDateTime(normalizedStart);
      const end = parseBookingDateTime(normalizedEnd);

      if (!start || !end) {
        showToast("warning", "Invalid time format.");
        return;
      }

      if (end <= start) {
        showToast(
          "warning",
          "Please select an End time later than the Start time.",
        );
        return;
      }
    }

    setAppliedStartTimeFilter(normalizedStart);
    setAppliedEndTimeFilter(normalizedEnd);
    setAppliedLocationCode(locationCodeFilter.trim());
    setAppliedBuildingId(selectedBuildingId);
    setAppliedFloorId(selectedFloorId);
    setAppliedStatusFilter(statusFilter);
    setPage(1);
  };

  const handleClearStartTimeSearch = () => {
    setStartDateFilter("");
    setStartHourFilter("00");
    setStartMinuteFilter("00");
    setEndDateFilter("");
    setEndHourFilter("23");
    setEndMinuteFilter("59");
    setLocationCodeFilter("");
    setSelectedBuildingId("all");
    setSelectedFloorId("all");
    setStatusFilter("all");
    setAppliedStartTimeFilter("");
    setAppliedEndTimeFilter("");
    setAppliedLocationCode("");
    setAppliedBuildingId("all");
    setAppliedFloorId("all");
    setAppliedStatusFilter("all");
    setPage(1);
  };

  const tabItems = useMemo(
    () => [
      {
        key: "ongoing",
        label: (
          <span className="font-medium tracking-wide">
            On-going / In-coming Meeting
          </span>
        ),
      },
      {
        key: "meeting-with-event",
        label: (
          <span className="font-medium tracking-wide">Meeting with Event</span>
        ),
      },
      {
        key: "history",
        label: (
          <span className="font-medium tracking-wide">Booking History</span>
        ),
      },
      {
        key: "invitations",
        label: (
          <span className="font-medium tracking-wide">Event Invitations</span>
        ),
      },
    ],
    [],
  );

  const locationCodeColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(
          bookings
            .map((item) => String(item.locationCode || "").trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ text: value, value })),
    [bookings],
  );

  const floorColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(
          bookings
            .map((item) => String(item.floor || "").trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ text: value, value })),
    [bookings],
  );

  const buildingColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(
          bookings
            .map((item) =>
              String(item.buildingName || item.address || "").trim(),
            )
            .filter(Boolean),
        ),
      ).map((value) => ({ text: value, value })),
    [bookings],
  );

  const statusColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(
          bookings
            .map((item) => String(item.status || "").trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ text: value, value })),
    [bookings],
  );

  const columns: ColumnsType<Reservation> = [
    {
      title: "LOCATION CODE",
      dataIndex: "locationCode",
      key: "locationCode",
      width: "17%",
      sorter: (a, b) =>
        String(a.locationCode || "").localeCompare(
          String(b.locationCode || ""),
        ),
      filters: locationCodeColumnFilters,
      onFilter: (value, record) =>
        String(record.locationCode || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (value: string | undefined) => (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
          {value || "—"}
        </span>
      ),
    },
    {
      title: "FLOOR",
      dataIndex: "floor",
      key: "floor",
      width: "10%",
      sorter: (a, b) =>
        String(a.floor || "").localeCompare(String(b.floor || "")),
      filters: floorColumnFilters,
      onFilter: (value, record) =>
        String(record.floor || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (value: string | undefined) => (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
          {value || "—"}
        </span>
      ),
    },
    {
      title: "BUILDING",
      dataIndex: "buildingName",
      key: "buildingName",
      width: "17%",
      sorter: (a, b) =>
        String(a.buildingName || a.address || "").localeCompare(
          String(b.buildingName || b.address || ""),
        ),
      filters: buildingColumnFilters,
      onFilter: (value, record) =>
        String(record.buildingName || record.address || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (_: string | undefined, record: Reservation) => (
        <span className="text-sm font-medium text-slate-700">
          {record.buildingName || record.address || "—"}
        </span>
      ),
    },
    {
      title: "DETAILS",
      key: "details",
      width: "20%",
      render: (_: unknown, record: Reservation) => (
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-start gap-1">
            <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Purpose
            </span>
            <span className="text-slate-700">{record.purpose || "—"}</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Note
            </span>
            <span
              className="max-w-[160px] truncate text-slate-600"
              title={record.note || ""}
            >
              {record.note || "—"}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "TIME",
      key: "time",
      width: "22%",
      sorter: (a, b) => {
        const left = parseBookingDateTime(a.startTime)?.getTime() || 0;
        const right = parseBookingDateTime(b.startTime)?.getTime() || 0;
        return left - right;
      },
      render: (_: unknown, record: Reservation) => (
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="w-8 text-slate-400">Start</span>
            <span className="font-medium text-slate-700">
              {formatDatePart(record.startTime)}
            </span>
            <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
              {formatTimePart(record.startTime)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5 shrink-0 text-orange-400" />
            <span className="w-8 text-slate-400">End</span>
            <span className="font-medium text-slate-700">
              {formatDatePart(record.endTime)}
            </span>
            <span className="whitespace-nowrap rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-600">
              {formatTimePart(record.endTime)}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "11%",
      sorter: (a, b) =>
        String(a.status || "").localeCompare(String(b.status || "")),
      filters: statusColumnFilters,
      onFilter: (value, record) =>
        String(record.status || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (status: string | undefined) => {
        const s = String(status || "").toUpperCase();
        const label =
          s === "RESERVED"
            ? "Reserved"
            : s === "IN_USE" || s === "CHECKED_IN"
              ? "In Use"
              : s === "COMPLETED"
                ? "Completed"
                : s === "CANCELLED"
                  ? "Cancelled"
                  : s === "NO_SHOW"
                    ? "No Show"
                    : s === "FORCE_CANCELLED"
                      ? "Force Cancelled"
                      : status || "—";
        const cls =
          s === "RESERVED"
            ? "bg-emerald-50 text-emerald-700"
            : s === "IN_USE" || s === "CHECKED_IN"
              ? "bg-blue-50 text-blue-700"
              : s === "COMPLETED"
                ? "bg-cyan-50 text-cyan-700"
                : s === "CANCELLED" || s === "FORCE_CANCELLED"
                  ? "bg-red-50 text-red-600"
                  : s === "NO_SHOW"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-500";
        return (
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      title: "ACTIONS",
      key: "actions",
      width: "28%",
      render: (_: unknown, record: Reservation) => {
        const status = record.status || "";
        const isLoading = actionLoadingId === record.id;
        const checkInEnabled = canCheckIn(
          status,
          record.startTime,
          record.endTime,
          currentTime,
        );
        const returnRoomEnabled = canCheckOut(
          status,
          record.startTime,
          record.endTime,
          currentTime,
        );
        const extendEnabled = canExtend(
          status,
          record.startTime,
          record.endTime,
          currentTime,
        );
        const cancelEnabled = canCancel(
          status,
          record.startTime,
          record.endTime,
          currentTime,
        );
        const canShowFeedback =
          activeTab === "ongoing" &&
          status?.toUpperCase() === "COMPLETED" &&
          record.id &&
          !record.feedbackSubmitted;
        const canRender = {
          checkIn: !!record.id && checkInEnabled,
          returnRoom: !!record.id && returnRoomEnabled,
          extend: !!record.id && extendEnabled,
          cancel: !!record.id && cancelEnabled,
          feedback: canShowFeedback,
        };

        if (
          !canRender.checkIn &&
          !canRender.returnRoom &&
          !canRender.extend &&
          !canRender.cancel &&
          !canRender.feedback
        ) {
          return (
            <span className="text-xs text-gray-400">No available actions</span>
          );
        }

        return (
          <div className="flex flex-wrap gap-1.5">
            {/* Manage Event button */}
            {record.purpose?.toLowerCase().includes("event") ||
            record.note?.toLowerCase().includes("event") ? (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    ROUTES.EVENT_SETUP.replace(
                      ":reservationId",
                      String(record.id),
                    ),
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600"
              >
                Manage Event
              </button>
            ) : null}

            {canRender.checkIn && (
              <button
                type="button"
                disabled={isLoading && checkInEnabled}
                onClick={() => openActionModal("check-in", record)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
              >
                {isLoading && checkInEnabled && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                Check-in
              </button>
            )}

            {canRender.returnRoom && (
              <button
                type="button"
                disabled={isLoading && returnRoomEnabled}
                onClick={() => openActionModal("return-room", record)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60"
              >
                {isLoading && returnRoomEnabled && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                Check Out
              </button>
            )}

            {canRender.extend && (
              <button
                type="button"
                disabled={isLoading && extendEnabled}
                onClick={() => openActionModal("extend", record)}
                className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-60"
              >
                {isLoading && extendEnabled && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
                )}
                Extend
              </button>
            )}

            {canRender.cancel && (
              <button
                type="button"
                disabled={isLoading && cancelEnabled}
                onClick={() => openActionModal("cancel", record)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
              >
                {isLoading && cancelEnabled && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
                )}
                Cancel
              </button>
            )}

            {canRender.feedback && (
              <button
                type="button"
                onClick={() => openFeedbackModal(record)}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
              >
                Feedback
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={2}>My Bookings</Title>
          <Paragraph className="text-gray-600">
            View and manage your room reservations.
          </Paragraph>
        </div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.ROOM_LIST)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-orange-600"
        >
          Book a room
        </button>
      </div>

      <Tabs
        activeKey={activeTab}
        items={tabItems}
        onChange={handleTabChange}
        className="mb-2"
      />

      {activeTab !== "invitations" ? (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 xl:col-span-6">
              <div className="mb-2 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                Start time
              </div>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0">
                  <DatePickerField
                    value={startDateFilter}
                    onChange={(nextDate) => setStartDateFilter(nextDate)}
                  />
                </div>
                <div className="shrink-0">
                  <TimeSelectField
                    value={`${startHourFilter}:${startMinuteFilter}`}
                    onChange={(nextValue) => {
                      const nextParts = splitTimeValue(
                        nextValue,
                        startHourFilter,
                        startMinuteFilter,
                      );
                      setStartHourFilter(nextParts.hour);
                      setStartMinuteFilter(nextParts.minute);
                    }}
                    minuteStep={5}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 xl:col-span-6">
              <div className="mb-2 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                End time
              </div>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0">
                  <DatePickerField
                    value={endDateFilter}
                    minDate={startDateFilter || undefined}
                    onChange={(nextDate) => setEndDateFilter(nextDate)}
                  />
                </div>
                <div className="shrink-0">
                  <TimeSelectField
                    value={`${endHourFilter}:${endMinuteFilter}`}
                    onChange={(nextValue) => {
                      const nextParts = splitTimeValue(
                        nextValue,
                        endHourFilter,
                        endMinuteFilter,
                      );
                      setEndHourFilter(nextParts.hour);
                      setEndMinuteFilter(nextParts.minute);
                    }}
                    minuteStep={5}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 xl:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Location code
              </label>
              <Input
                value={locationCodeFilter}
                onChange={(event) => setLocationCodeFilter(event.target.value)}
                placeholder="Search location code"
                allowClear
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 xl:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Building
              </label>
              <Select
                value={selectedBuildingId}
                className="w-full"
                onChange={handleBuildingFilterChange}
                options={[
                  { value: "all", label: "All buildings" },
                  ...buildingOptions,
                ]}
                placeholder="Filter by building"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 xl:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Floor
              </label>
              <Select
                value={selectedFloorId}
                className="w-full"
                onChange={handleFloorFilterChange}
                disabled={selectedBuildingId === "all"}
                options={[
                  { value: "all", label: "All floors" },
                  ...floorOptions,
                ]}
                placeholder="Filter by floor"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 xl:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Status
              </label>
              <Select
                value={statusFilter}
                className="w-full"
                onChange={setStatusFilter}
                options={statusSearchOptions}
                placeholder="Filter by status"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Search
            </button>

            <button
              type="button"
              onClick={handleClearStartTimeSearch}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Clear search
            </button>

            <button
              type="button"
              onClick={() =>
                loadBookings(
                  page,
                  pageSize,
                  activeTab,
                  appliedBuildingId,
                  appliedFloorId,
                  appliedLocationCode,
                  appliedStatusFilter,
                  appliedStartTimeFilter,
                  appliedEndTimeFilter,
                  invitations,
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      {activeTab !== "invitations" ? (
        <>
          {null /* errors are shown via toast */}

          {bookings.length === 0 && !loading && !error ? (
            <Empty
              image={
                <CalendarOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />
              }
              description={
                activeTab === "history"
                  ? "No booking history yet."
                  : activeTab === "meeting-with-event"
                    ? "No meetings with events."
                    : "No on-going/in-coming meetings."
              }
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <Table<Reservation>
                rowKey={(record, index) =>
                  record.id ||
                  `${record.locationCode || "no-code"}-${record.startTime || "no-time"}-${index}`
                }
                loading={loading}
                columns={
                  activeTab === "history"
                    ? columns.filter((col) => col.key !== "actions")
                    : columns
                }
                dataSource={bookings}
                pagination={false}
                onChange={handleTableChange}
                onRow={(record) => ({
                  onClick: (event) => {
                    const target = event.target as HTMLElement;
                    if (
                      target.closest("button") ||
                      target.closest(".ant-btn")
                    ) {
                      return;
                    }

                    if (!record.id) return;
                    navigate(
                      ROUTES.BOOKING_DETAIL.replace(":bookingId", record.id),
                      {
                        state: { booking: record },
                      },
                    );
                  },
                })}
                rowClassName={(record) => (record.id ? "cursor-pointer" : "")}
                scroll={{ x: 980 }}
              />
              
              {/* Custom Pagination */}
              {total > 0 && (
                <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <CustomPagination
                      currentPage={page}
                      totalPages={Math.ceil(total / pageSize)}
                      onPageChange={(p) => setPage(p)}
                      totalItems={total}
                      pageSize={pageSize}
                      className="w-full lg:flex-1"
                    />

                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}


        </>
      ) : (
        <>
          {null /* errors are shown via toast */}

          {invitations.length === 0 &&
          !invitationsLoading &&
          !invitationsError ? (
            <Empty
              image={
                <CalendarOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />
              }
              description="No event invitations."
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <Table<EventInvitation>
                rowKey={(record) => record.id}
                loading={invitationsLoading}
                dataSource={invitations}
                pagination={false}
                columns={[
                  {
                    title: "EVENT",
                    dataIndex: "eventTitle",
                    key: "eventTitle",
                    render: (value: string | undefined) => value || "-",
                  },
                  {
                    title: "ROOM",
                    dataIndex: "roomLocationCode",
                    key: "roomLocationCode",
                    render: (value: string | undefined) => value || "-",
                  },
                  {
                    title: "TIME",
                    key: "time",
                    render: (_: unknown, record: EventInvitation) =>
                      `${formatDateTime(String(record.reservationStartTime || ""))} → ${formatDateTime(
                        String(record.reservationEndTime || ""),
                      )}`,
                  },
                  {
                    title: "STATUS",
                    dataIndex: "inviteStatus",
                    key: "inviteStatus",
                    render: (value: string | undefined) => {
                      const normalized = String(value || "").toUpperCase();
                      const label =
                        normalized === "ACCEPTED"
                          ? "Accepted"
                          : normalized === "DECLINED"
                            ? "Declined"
                            : normalized === "INVITED"
                              ? "Invited"
                              : value || "—";
                      const cls =
                        normalized === "ACCEPTED"
                          ? "bg-emerald-50 text-emerald-700"
                          : normalized === "DECLINED"
                            ? "bg-red-50 text-red-600"
                            : normalized === "INVITED"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-500";
                      const dotCls =
                        normalized === "ACCEPTED"
                          ? "bg-emerald-500"
                          : normalized === "INVITED"
                            ? "bg-amber-500"
                            : null;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
                        >
                          {dotCls && (
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${dotCls}`}
                            />
                          )}
                          {label}
                        </span>
                      );
                    },
                  },
                  {
                    title: "CHECK-IN",
                    dataIndex: "checkInStatus",
                    key: "checkInStatus",
                    render: (value: string | undefined) => {
                      const normalized = String(value || "").toUpperCase();
                      const isCheckedIn = normalized === "CHECKED_IN";
                      const label = isCheckedIn
                        ? "Checked In"
                        : normalized === "NOT_CHECKED_IN"
                          ? "Not Checked In"
                          : value || "—";
                      return (
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isCheckedIn
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {label}
                        </span>
                      );
                    },
                  },
                  {
                    title: "ACTION",
                    key: "action",
                    render: (_: unknown, record: EventInvitation) => (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!record.reservationId) return;
                            navigate(
                              ROUTES.EVENT_LIVE.replace(
                                ":reservationId",
                                String(record.reservationId),
                              ),
                            );
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View
                        </button>
                        {String(record.inviteStatus || "").toUpperCase() ===
                        "INVITED" ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                respondInvitation(record.id, "ACCEPT")
                              }
                              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                respondInvitation(record.id, "DECLINE")
                              }
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                            >
                              Decline
                            </button>
                          </>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </>
      )}

      <Modal
        open={!!actionModal}
        onCancel={closeActionModal}
        title={
          <div className="flex items-center gap-2">
            {actionModal?.type === "check-in" ? (
              <>
                <CheckBadgeIcon className="h-5 w-5 text-emerald-600" />
                <span>Check-in meeting</span>
              </>
            ) : actionModal?.type === "return-room" ? (
              <>
                <ClockIcon className="h-5 w-5 text-blue-600" />
                <span>Return room</span>
              </>
            ) : actionModal?.type === "extend" ? (
              <>
                <ClockIcon className="h-5 w-5 text-orange-600" />
                <span>Extend room</span>
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                <span>Cancel booking</span>
              </>
            )}
          </div>
        }
        okText={
          actionModal?.type === "check-in"
            ? "Confirm check-in"
            : actionModal?.type === "return-room"
              ? "Confirm return"
              : actionModal?.type === "extend"
                ? "Confirm extend"
                : "Confirm cancel"
        }
        cancelText="Close"
        onOk={handleConfirmAction}
        width={700}
        okButtonProps={{
          loading:
            !!actionModal?.booking?.id &&
            actionLoadingId === actionModal.booking.id,
          className:
            "!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600 !text-white !h-10 !rounded-lg !font-semibold !transition-all",
        }}
        cancelButtonProps={{
          className:
            "!bg-slate-200 !hover:bg-slate-300 !text-slate-800 !border-slate-200 !h-10 !rounded-lg !font-semibold !transition-all",
        }}
        className="[&_.ant-modal-content]:rounded-2xl [&_.ant-modal-content]:shadow-lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {actionModal?.type === "check-in"
              ? "Review booking details before check-in."
              : actionModal?.type === "return-room"
                ? "Review booking details before returning the room."
                : actionModal?.type === "extend"
                  ? "Choose extended hours before confirming."
                  : "Review booking details before canceling this booking."}
          </div>

          {actionModal?.type === "cancel" &&
            userProfile?.cancellationCount === 2 && (
              <Alert
                type="warning"
                showIcon
                message="Cảnh báo quan trọng"
                description="Bạn đã hủy đặt phòng 2 lần trong ngày hôm nay. Nếu hủy thêm lần này (lần thứ 3), chức năng đặt phòng của bạn sẽ bị khóa trong 24 giờ tới."
                className="border-amber-200 bg-amber-50"
              />
            )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Location
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {actionModal?.booking.locationCode || "-"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Floor
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {actionModal?.booking.floor || "-"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Building
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {actionModal?.booking.buildingName ||
                    actionModal?.booking.address ||
                    "-"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Status
                </p>
                <div className="mt-1">
                  <Tag
                    color={getStatusColor(actionModal?.booking.status || "")}
                  >
                    {actionModal?.booking.status || "-"}
                  </Tag>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Start time
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {formatDateTime(actionModal?.booking.startTime || "")}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  End time
                </p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {formatDateTime(actionModal?.booking.endTime || "")}
                </p>
              </div>
            </div>
            {(actionModal?.booking.purpose || actionModal?.booking.note) && (
              <div className="border-t border-slate-100 pt-3 space-y-2">
                {actionModal?.booking.purpose && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Purpose
                    </p>
                    <p className="text-sm text-slate-700 mt-1">
                      {actionModal.booking.purpose}
                    </p>
                  </div>
                )}
                {actionModal?.booking.note && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Note
                    </p>
                    <p className="text-sm text-slate-700 mt-1">
                      {actionModal.booking.note}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {actionModalError && (
            <Alert
              type="error"
              showIcon
              message={actionModalError}
              className="rounded-lg"
            />
          )}

          {actionModal?.type === "extend" && (
            <div className="rounded-xl border border-slate-200 bg-blue-50 p-3">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Extend hour(s)
              </label>
              <InputNumber
                min={1}
                max={8}
                step={1}
                value={extendHour}
                onChange={(value) =>
                  setExtendHour(typeof value === "number" ? value : 1)
                }
                className="w-24 text-center"
              />
              <p className="text-xs text-slate-600 mt-2">
                Extend your meeting by {extendHour} hour
                {extendHour > 1 ? "s" : ""}
              </p>
            </div>
          )}

          {actionModal?.type === "cancel" && (
            <div className="rounded-xl border border-slate-200 bg-red-50 p-3">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Cancellation reason <span className="text-red-500">*</span>
              </label>
              <Input.TextArea
                rows={3}
                maxLength={400}
                showCount
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Enter reason for cancellation"
                className="border-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!feedbackModal}
        onCancel={closeFeedbackModal}
        width={800}
        title={
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-sky-600" />
            <span>Share your feedback</span>
          </div>
        }
        okText="Submit feedback"
        cancelText="Skip"
        onOk={handleSubmitFeedback}
        okButtonProps={{
          loading: submittingFeedback,
          className:
            "!bg-sky-600 hover:!bg-sky-700 !border-sky-600 !text-white !h-10 !rounded-lg !font-semibold !transition-all",
        }}
        cancelButtonProps={{
          disabled: submittingFeedback,
          className:
            "!bg-slate-200 !hover:bg-slate-300 !text-slate-800 !border-slate-200 !h-10 !rounded-lg !font-semibold !transition-all",
        }}
        className="[&_.ant-modal-content]:rounded-2xl [&_.ant-modal-content]:shadow-lg"
      >
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5">
          <p className="text-base text-slate-700 font-medium mb-5">
            Help us improve! Share your experience about the meeting room you
            just used.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MapPinIcon className="h-4 w-4 text-sky-600" />
                Booking details
              </h4>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPinIcon className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">
                      Location
                    </p>
                    <p className="font-medium text-slate-800">
                      {feedbackModal?.booking.locationCode || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <ClockIcon className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">
                      Start time
                    </p>
                    <p className="font-medium text-slate-800">
                      {formatDateTime(feedbackModal?.booking.startTime || "")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <ClockIcon className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">
                      End time
                    </p>
                    <p className="font-medium text-slate-800">
                      {formatDateTime(feedbackModal?.booking.endTime || "")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <StarIcon className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">
                      Building
                    </p>
                    <p className="font-medium text-slate-800">
                      {feedbackModal?.booking.buildingName ||
                        feedbackModal?.booking.address ||
                        "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <StarIcon className="h-4 w-4 text-amber-500" />
                Your rating
              </h4>

              <div className="rounded-lg border-2 border-amber-100 bg-amber-50 p-4">
                <div className="flex justify-center">
                  <Rate value={feedbackRating} onChange={setFeedbackRating} />
                </div>
                <p className="text-center mt-3 text-sm text-slate-700">
                  Satisfaction level:{" "}
                  <span className="font-bold text-amber-600">
                    {feedbackRating}/5
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ChatBubbleLeftRightIcon className="h-4 w-4 text-sky-600" />
              Your feedback <span className="text-red-500">*</span>
            </label>
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="Share your thoughts about this room..."
              value={feedbackDescription}
              onChange={(event) => setFeedbackDescription(event.target.value)}
              className="text-sm border-slate-200 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-2">
              Your feedback helps us provide better room facilities and
              services.
            </p>
          </div>
        </div>
      </Modal>

      {toastPopup && (
        <CustomMessage
          type={toastPopup.type}
          message={toastPopup.message}
          onClose={() => setToastPopup(null)}
        />
      )}
    </div>
  );
};

export default MyBookingsPage;
