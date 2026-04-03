import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Typography,
  Empty,
  Table,
  Tag,
  Alert,
  Button,
  Space,
  Tooltip,
  Tabs,
  Modal,
  Descriptions,
  Select,
  Input,
  InputNumber,
  Rate,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table";
import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  MapPinIcon,
  SparklesIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
// start add authService import
import { getProfile } from "../../services/authService";
import { adminService } from "../../services/adminService";
import type { UserProfile } from "../../types";
// end add authService import
import { reservationService } from "../../services/reservationService";
import { feedbackService } from "../../services/feedbackService";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { Reservation, WebSocketMessage } from "../../types";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { useWebSocket } from "../../hooks/useWebSocket";
import DatePickerField from "../../components/common/DatePickerField";
import { HOUR_OPTIONS, MINUTE_OPTIONS, buildDateTime } from "../../utils";

const { Title, Paragraph } = Typography;

type BookingTabKey = "history" | "ongoing";
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
        item.floorNumber != null ? `num-${item.floorNumber}` : `value-${item.value}`,
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
};

const filterItemsByTab = (items: Reservation[], tabKey: BookingTabKey) => {
  const allowedStatuses = [
    ...TAB_STATUS_FILTERS.ongoing,
    ...TAB_STATUS_FILTERS.history,
  ];

  if (tabKey === "history") {
    return items.filter((item) => {
      const status = (item.status || "").toUpperCase();
      return TAB_STATUS_FILTERS.history.includes(status);
    });
  }

  return items.filter((item) => {
    const status = (item.status || "").toUpperCase();
    return TAB_STATUS_FILTERS.ongoing.includes(status) || !allowedStatuses.includes(status);
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
  return date.toLocaleString();
};

const formatDatePart = (value?: string) => {
  const date = parseBookingDateTime(value);
  if (!date) return "-";
  return date.toLocaleDateString();
};

const formatTimePart = (value?: string) => {
  const date = parseBookingDateTime(value);
  if (!date) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const isInvalidDateFormatError = (error: unknown) => {
  const message = extractApiMessage(error, "").toLowerCase();
  return (
    message.includes("invalid date format") ||
    message.includes("date format") ||
    message.includes("invalid date") ||
    message.includes("định dạng ngày")
  );
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
const canCheckIn = (status: string, startTime?: string, endTime?: string, now: Date = new Date()) => {
  const normalized = status.toUpperCase();
  if (
    ["IN_USE", "CHECKED_IN", "CANCELLED", "COMPLETED", "REJECTED", "NO_SHOW"].includes(
      normalized,
    )
  ) {
    return false;
  }
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);

  if (!start || !end) return false;
  return now >= start && now <= end;
};

const canCheckOut = (status: string, startTime?: string, endTime?: string, now: Date = new Date()) => {
  const normalized = status.toUpperCase();
  if (!["IN_USE", "CHECKED_IN"].includes(normalized)) return false;
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);
  if (!start || !end) return false;

  return now >= start && now <= end;
};

const canExtend = (status: string, startTime?: string, endTime?: string, now: Date = new Date()) => {
  const normalized = status.toUpperCase();
  if (!["IN_USE", "CHECKED_IN"].includes(normalized)) return false;
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);
  if (!start || !end) return false;

  return now >= start && now <= end;
};

const canCancel = (status: string, startTime?: string, now: Date = new Date()) => {
  const normalized = status.toUpperCase();
  if (["CANCELLED", "COMPLETED", "REJECTED"].includes(normalized)) return false;

  const start = parseBookingDateTime(startTime);
  if (!start) return false;

  return now < start;
};

const getCheckInDisabledReason = (record: Reservation, now: Date = new Date()) => {
  if (!record.id) return "Không thể thao tác vì thiếu mã booking từ API.";

  const status = (record.status || "").toUpperCase();
  if (
    ["IN_USE", "CHECKED_IN", "CANCELLED", "COMPLETED", "REJECTED", "NO_SHOW"].includes(
      status,
    )
  ) {
    return `Booking đang ở trạng thái ${status || "N/A"} nên không thể check-in.`;
  }

  const start = parseBookingDateTime(record.startTime);
  const end = parseBookingDateTime(record.endTime);
  if (!start || !end) {
    return "Thiếu thời gian bắt đầu/kết thúc từ API nên không thể check-in.";
  }

  if (now < start) {
    return `Chưa đến thời gian check-in. Bắt đầu lúc ${formatDateTime(record.startTime || "")}.`;
  }
  if (now > end) {
    return "Đã quá thời gian booking nên không thể check-in.";
  }
  return undefined;
};

const getCancelDisabledReason = (record: Reservation, now: Date = new Date()) => {
  if (!record.id) return "Không thể thao tác vì thiếu mã booking từ API.";

  const status = (record.status || "").toUpperCase();
  if (["CANCELLED", "COMPLETED", "REJECTED"].includes(status)) {
    return `Booking đang ở trạng thái ${status || "N/A"} nên không thể hủy.`;
  }

  const start = parseBookingDateTime(record.startTime);
  if (!start) {
    return "Thiếu thời gian bắt đầu từ API nên không thể xác định quyền hủy.";
  }

  if (now >= start) {
    return "Chỉ có thể hủy booking trước khi cuộc họp bắt đầu.";
  }
  return undefined;
};

const getCheckOutDisabledReason = (record: Reservation, now: Date = new Date()) => {
  if (!record.id) return "Không thể thao tác vì thiếu mã booking từ API.";

  const status = (record.status || "").toUpperCase();
  if (!["IN_USE", "CHECKED_IN"].includes(status)) {
    return `Booking đang ở trạng thái ${status || "N/A"} nên chưa thể trả phòng.`;
  }

  const start = parseBookingDateTime(record.startTime);
  const end = parseBookingDateTime(record.endTime);
  if (!start || !end) {
    return "Thiếu thời gian bắt đầu/kết thúc từ API nên không thể trả phòng.";
  }

  if (now < start || now > end) {
    return "Chỉ có thể trả phòng khi cuộc họp đang diễn ra.";
  }

  return undefined;
};

const getExtendDisabledReason = (record: Reservation, now: Date = new Date()) => {
  if (!record.id) return "Không thể thao tác vì thiếu mã booking từ API.";

  const status = (record.status || "").toUpperCase();
  if (!["IN_USE", "CHECKED_IN"].includes(status)) {
    return `Booking đang ở trạng thái ${status || "N/A"} nên chưa thể gia hạn.`;
  }

  const start = parseBookingDateTime(record.startTime);
  const end = parseBookingDateTime(record.endTime);
  if (!start || !end) {
    return "Thiếu thời gian bắt đầu/kết thúc từ API nên không thể gia hạn.";
  }

  if (now < start || now > end) {
    return "Chỉ có thể gia hạn khi cuộc họp đang diễn ra.";
  }

  return undefined;
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
  const [buildingOptions, setBuildingOptions] = useState<BuildingFilterOption[]>([]);
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
  const [appliedStartTimeFilter, setAppliedStartTimeFilter] = useState<string>("");
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
      const userData = (response.data as any)?.data || response.data;
      setUserProfile(userData as UserProfile);
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
        const response = await adminService.getFloorsByBuilding(selectedBuildingId);
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
    ) => {
      setLoading(true);
      setError(null);
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

        const hasTimeRange = Boolean(startTimeValue && endTimeValue);
        const requiresClientFiltering = hasTimeRange || floorId !== "all";

        if (requiresClientFiltering) {
          // Fetch full data then apply FE filters for floor/time compatibility.
          const largePageSize = 1000;
          let allItems: Reservation[] = [];

          try {
            const result = await reservationService.getMyBookings({
              page: 0,
              size: largePageSize,
              statuses: requestedStatuses,
              buildingId: buildingId !== "all" ? buildingId : undefined,
              locationCode: locationCode.trim() || undefined,
            });
            allItems = result.items;
          } catch {
            const fallbackResult = await reservationService.getMyBookings({
              page: 0,
              size: largePageSize,
              buildingId: buildingId !== "all" ? buildingId : undefined,
              locationCode: locationCode.trim() || undefined,
            });
            allItems =
              normalizedStatus && normalizedStatus !== "ALL"
                ? fallbackResult.items.filter(
                    (item) => (item.status || "").toUpperCase() === normalizedStatus,
                  )
                : filterItemsByTab(fallbackResult.items, tabKey);
          }

          if (selectedBuilding?.label) {
            allItems = allItems.filter((item) => {
              const buildingName = (item.buildingName || item.address || "").toLowerCase();
              return buildingName.includes(selectedBuilding.label.toLowerCase());
            });
          }

          if (selectedFloor?.label) {
            allItems = allItems.filter((item) => {
              const floorName = String(item.floor || "").toLowerCase();
              return floorName.includes(selectedFloor.label.toLowerCase());
            });
          }

          if (hasTimeRange) {
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

          const startIndex = Math.max(nextPage - 1, 0) * nextSize;
          const paged = allItems.slice(startIndex, startIndex + nextSize);

          setBookings(paged);
          setTotal(allItems.length);
        } else {
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
          } catch {
            const fallbackResult = await reservationService.getMyBookings({
              page: Math.max(nextPage - 1, 0),
              size: nextSize,
              buildingId: buildingId !== "all" ? buildingId : undefined,
              locationCode: locationCode.trim() || undefined,
            });
            let filteredItems =
              normalizedStatus && normalizedStatus !== "ALL"
                ? fallbackResult.items.filter(
                    (item) => (item.status || "").toUpperCase() === normalizedStatus,
                  )
                : filterItemsByTab(fallbackResult.items, tabKey);
            if (selectedBuilding?.label) {
              filteredItems = filteredItems.filter((item) => {
                const buildingName = (item.buildingName || item.address || "").toLowerCase();
                return buildingName.includes(selectedBuilding.label.toLowerCase());
              });
            }
            setBookings(filteredItems);
            setTotal(filteredItems.length);
          }
        }

        setPage(nextPage);
        setPageSize(nextSize);
      } catch (err) {
        setError(extractApiMessage(err, "Unable to load bookings"));
        setBookings([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [buildingOptions, floorOptions],
  );

  useEffect(() => {
    loadBookings(
      1,
      pageSize,
      activeTab,
      appliedBuildingId,
      appliedFloorId,
      appliedLocationCode,
      appliedStatusFilter,
      appliedStartTimeFilter,
      appliedEndTimeFilter,
    );
  }, [
    loadBookings,
    pageSize,
    activeTab,
    appliedBuildingId,
    appliedFloorId,
    appliedLocationCode,
    appliedStatusFilter,
    appliedStartTimeFilter,
    appliedEndTimeFilter,
  ]);

  useEffect(() => {
    const realtimePayload = getReservationRealtimePayload(lastMessage);
    if (!realtimePayload) {
      return;
    }

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

      return filterItemsByTab(updatedItems, activeTab);
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
    if (!feedbackDescription.trim()) {
      message.warning("Please enter your feedback.");
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
      );
    } catch (err) {
      message.error(extractApiMessage(err, "Unable to submit feedback"));
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
      message.warning("Chỉ được check-in trong khoảng thời gian đã đặt phòng.");
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
      message.warning("Chỉ có thể trả phòng khi cuộc họp đang diễn ra.");
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
      message.warning("Chỉ có thể gia hạn khi cuộc họp đang diễn ra.");
      return;
    }

    if (
      currentAction.type === "cancel" &&
      !canCancel(status, currentAction.booking.startTime, now)
    ) {
      message.warning("Chỉ có thể hủy booking trước khi cuộc họp bắt đầu.");
      return;
    }

    if (currentAction.type === "cancel" && !cancelReason.trim()) {
      message.warning("Please provide a cancellation reason.");
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

      message.success(
        extractBackendSuccessMessage(actionResponse, actionSuccessFallback),
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
      );
    } catch (err) {
      const actionErrorMessage = extractApiMessage(
        err,
        currentAction.type === "check-in"
          ? "Không thể check-in booking"
          : currentAction.type === "return-room"
            ? "Không thể trả phòng"
            : currentAction.type === "extend"
              ? "Không thể gia hạn phòng"
              : "Không thể hủy booking",
      );
      setActionModalError(actionErrorMessage);
      message.error(actionErrorMessage);
    } finally {
      setLoading(false);
      setActionLoadingId(null);
    }
  };

  const handleTabChange = (key: string) => {
    const nextTab = key as BookingTabKey;
    setActiveTab(nextTab);
    setPage(1);
  };

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: unknown,
    _sorter: unknown,
    extra: { action?: string },
  ) => {
    // Keep filter/sort on current page data in FE; only reload from API when paginating.
    if (extra?.action && extra.action !== "paginate") {
      return;
    }

    const nextPage = pagination.current || 1;
    const nextSize = pagination.pageSize || pageSize;
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

  const timeRangeMessage = useMemo(() => {
    const startValue = startDateFilter
      ? buildDateTime(startDateFilter, startHourFilter, startMinuteFilter)
      : "";
    const endValue = endDateFilter
      ? buildDateTime(endDateFilter, endHourFilter, endMinuteFilter)
      : "";

    if (!startValue && !endValue) return null;

    if (!startValue || !endValue) {
      return {
        type: "warning" as const,
        text: "Vui lòng nhập đầy đủ cả Start time và End time.",
      };
    }

    const start = parseBookingDateTime(startValue);
    const end = parseBookingDateTime(endValue);

    if (!start || !end) {
      return {
        type: "error" as const,
        text: "Định dạng thời gian không hợp lệ.",
      };
    }

    if (end <= start) {
      return {
        type: "error" as const,
        text: "Vui lòng chọn lại End time lớn hơn Start time.",
      };
    }

    return null;
  }, [
    endDateFilter,
    endHourFilter,
    endMinuteFilter,
    startDateFilter,
    startHourFilter,
    startMinuteFilter,
  ]);

  const handleApplyFilters = () => {
    const normalizedStart = startDateFilter
      ? buildDateTime(startDateFilter, startHourFilter, startMinuteFilter)
      : "";
    const normalizedEnd = endDateFilter
      ? buildDateTime(endDateFilter, endHourFilter, endMinuteFilter)
      : "";

    if ((normalizedStart && !normalizedEnd) || (!normalizedStart && normalizedEnd)) {
      message.warning("Vui lòng nhập đầy đủ cả Start time và End time để lọc theo thời gian.");
      return;
    }

    if (normalizedStart && normalizedEnd) {
      const start = parseBookingDateTime(normalizedStart);
      const end = parseBookingDateTime(normalizedEnd);

      if (!start || !end) {
        message.warning("Định dạng thời gian không hợp lệ.");
        return;
      }

      if (end <= start) {
        message.warning("Vui lòng chọn lại End time lớn hơn Start time.");
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
      { key: "ongoing", label: "On-going / In-coming Meeting" },
      { key: "history", label: "Booking History" },
    ],
    [],
  );

  const locationCodeColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(bookings.map((item) => String(item.locationCode || "").trim()).filter(Boolean)),
      ).map((value) => ({ text: value, value })),
    [bookings],
  );

  const floorColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(bookings.map((item) => String(item.floor || "").trim()).filter(Boolean)),
      ).map((value) => ({ text: value, value })),
    [bookings],
  );

  const buildingColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(
          bookings
            .map((item) => String(item.buildingName || item.address || "").trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ text: value, value })),
    [bookings],
  );

  const statusColumnFilters = useMemo(
    () =>
      Array.from(
        new Set(bookings.map((item) => String(item.status || "").trim()).filter(Boolean)),
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
        String(a.locationCode || "").localeCompare(String(b.locationCode || "")),
      filters: locationCodeColumnFilters,
      onFilter: (value, record) =>
        String(record.locationCode || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "FLOOR",
      dataIndex: "floor",
      key: "floor",
      width: "10%",
      sorter: (a, b) => String(a.floor || "").localeCompare(String(b.floor || "")),
      filters: floorColumnFilters,
      onFilter: (value, record) =>
        String(record.floor || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (value: string | undefined) => value || "-",
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
      render: (_: string | undefined, record: Reservation) =>
        record.buildingName || record.address || "-",
    },
    {
      title: "DETAILS",
      key: "details",
      width: "20%",
      render: (_: unknown, record: Reservation) => (
        <div className="text-xs space-y-1">
          <div>
            <span className="text-gray-500">Purpose:</span>{" "}
            <span className="text-gray-700">{record.purpose || "-"}</span>
          </div>
          <div className="truncate" title={record.note || ""}>
            <span className="text-gray-500">Note:</span>{" "}
            <span className="text-gray-700">{record.note || "-"}</span>
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
        <div className="text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-blue-500" />
            <span className="text-gray-500 min-w-[40px]">Start</span>
            <span className="font-medium text-gray-700">
              {formatDatePart(record.startTime)}
            </span>
            <Tag color="blue">{formatTimePart(record.startTime)}</Tag>
          </div>
          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-orange-500" />
            <span className="text-gray-500 min-w-[40px]">End</span>
            <span className="font-medium text-gray-700">
              {formatDatePart(record.endTime)}
            </span>
            <Tag color="orange">{formatTimePart(record.endTime)}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "11%",
      sorter: (a, b) => String(a.status || "").localeCompare(String(b.status || "")),
      filters: statusColumnFilters,
      onFilter: (value, record) =>
        String(record.status || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (status: string | undefined) => (
        <Tag color={getStatusColor(status || "")}>{status || "-"}</Tag>
      ),
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
        const cancelEnabled = canCancel(status, record.startTime, currentTime);
        const canRender = {
          checkIn: !!record.id && checkInEnabled,
          returnRoom: !!record.id && returnRoomEnabled,
          extend: !!record.id && extendEnabled,
          cancel: !!record.id && cancelEnabled,
        };

        if (!canRender.checkIn && !canRender.returnRoom && !canRender.extend && !canRender.cancel) {
          return <span className="text-xs text-gray-400">No available actions</span>;
        }

        return (
          <Space>
            {canRender.checkIn && (
              <span>
                <Button
                  type="primary"
                  size="small"
                  loading={isLoading && checkInEnabled}
                  onClick={() => openActionModal("check-in", record)}
                >
                  Check-in
                </Button>
              </span>
            )}

            {canRender.returnRoom && (
              <span>
                <Button
                  size="small"
                  loading={isLoading && returnRoomEnabled}
                  onClick={() => openActionModal("return-room", record)}
                >
                  Check Out
                </Button>
              </span>
            )}

            {canRender.extend && (
              <span>
                <Button
                  size="small"
                  loading={isLoading && extendEnabled}
                  onClick={() => openActionModal("extend", record)}
                >
                  Extend
                </Button>
              </span>
            )}

            {canRender.cancel && (
              <span>
                <Button
                  danger
                  size="small"
                  loading={isLoading && cancelEnabled}
                  onClick={() => openActionModal("cancel", record)}
                >
                  Cancel
                </Button>
              </span>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="fade-in">
      <Title level={2}>My Bookings</Title>
      <Paragraph className="text-gray-600 mb-6">
        View and manage your room reservations.
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        items={tabItems}
        onChange={handleTabChange}
        className="mb-2"
      />

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-700">Search Filters</p>
          </div>

          <button
            type="button"
            onClick={() => navigate(ROUTES.ROOM_LIST)}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-orange-600"
          >
            Book a room
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 xl:col-span-6">
            <div className="mb-2 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
              Start time
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <DatePickerField
                  value={startDateFilter}
                  onChange={(nextDate) => setStartDateFilter(nextDate)}
                />
              </div>
              <select
                value={startHourFilter}
                onChange={(event) => setStartHourFilter(event.target.value)}
                className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm tabular-nums text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
              <select
                value={startMinuteFilter}
                onChange={(event) => setStartMinuteFilter(event.target.value)}
                className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm tabular-nums text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {MINUTE_OPTIONS.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}m
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 xl:col-span-6">
            <div className="mb-2 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
              End time
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <DatePickerField
                  value={endDateFilter}
                  minDate={startDateFilter || undefined}
                  onChange={(nextDate) => setEndDateFilter(nextDate)}
                />
              </div>
              <select
                value={endHourFilter}
                onChange={(event) => setEndHourFilter(event.target.value)}
                className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm tabular-nums text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
              <select
                value={endMinuteFilter}
                onChange={(event) => setEndMinuteFilter(event.target.value)}
                className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm tabular-nums text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {MINUTE_OPTIONS.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}m
                  </option>
                ))}
              </select>
            </div>
          </div>

          {timeRangeMessage && (
            <div className="xl:col-span-12">
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  timeRangeMessage.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {timeRangeMessage.text}
              </div>
            </div>
          )}

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
              )
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Unable to load bookings"
          description={error}
        />
      )}

      {bookings.length === 0 && !loading && !error ? (
        <Empty
          image={
            <CalendarOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />
          }
          description={
            activeTab === "history"
              ? "No booking history yet."
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
            columns={columns}
            dataSource={bookings}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20"],
            }}
            onChange={handleTableChange}
            onRow={(record) => ({
              onClick: (event) => {
                const target = event.target as HTMLElement;
                if (target.closest("button") || target.closest(".ant-btn")) {
                  return;
                }

                if (!record.id) return;
                navigate(ROUTES.BOOKING_DETAIL.replace(":bookingId", record.id), {
                  state: { booking: record },
                });
              },
            })}
            rowClassName={(record) => (record.id ? "cursor-pointer" : "")}
            scroll={{ x: 980 }}
          />
        </div>
      )}

      <Modal
        open={!!actionModal}
        onCancel={closeActionModal}
        title={
          actionModal?.type === "check-in"
            ? "Check-in meeting"
            : actionModal?.type === "return-room"
              ? "Return room"
              : actionModal?.type === "extend"
                ? "Extend room"
                : "Cancel booking"
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
        okButtonProps={{
          loading:
            !!actionModal?.booking?.id &&
            actionLoadingId === actionModal.booking.id,
        }}
      >
        <p className="text-gray-600 mb-4">
          {actionModal?.type === "check-in"
            ? "Review booking details before check-in."
            : actionModal?.type === "return-room"
              ? "Review booking details before returning the room."
              : actionModal?.type === "extend"
                ? "Choose extended hours before confirming."
                : "Review booking details before canceling this booking."}
        </p>

        {actionModalError && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            message="Action failed"
            description={actionModalError}
          />
        )}

        {/* start add cancellation warning alert */}
        {actionModal?.type === "cancel" && userProfile?.cancellationCount === 2 && (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            message="Cảnh báo quan trọng"
            description="Bạn đã hủy đặt phòng 2 lần trong ngày hôm nay. Nếu hủy thêm lần này (lần thứ 3), chức năng đặt phòng của bạn sẽ bị khóa trong 24 giờ tới."
          />
        )}
        {/* end add cancellation warning alert */}

        {actionModal?.type === "extend" && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Extend hour(s)
            </label>
            <InputNumber
              min={1}
              max={4}
              step={1}
              value={extendHour}
              onChange={(value) =>
                setExtendHour(typeof value === "number" ? value : 1)
              }
            />
          </div>
        )}

        {actionModal?.type === "cancel" && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cancellation reason <span className="text-red-500">*</span>
            </label>
            <Input.TextArea
              rows={3}
              maxLength={400}
              showCount
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Enter reason for cancellation"
            />
          </div>
        )}

        <Descriptions
          size="small"
          column={1}
          bordered
          items={[
            {
              key: "location",
              label: "Location",
              children: actionModal?.booking.locationCode || "-",
            },
            {
              key: "floor",
              label: "Floor",
              children: actionModal?.booking.floor || "-",
            },
            {
              key: "building",
              label: "Building",
              children: actionModal?.booking.buildingName || actionModal?.booking.address || "-",
            },
            {
              key: "timeStart",
              label: "Start time",
              children: formatDateTime(actionModal?.booking.startTime || ""),
            },
            {
              key: "timeEnd",
              label: "End time",
              children: formatDateTime(actionModal?.booking.endTime || ""),
            },
            {
              key: "status",
              label: "Status",
              children: (
                <Tag color={getStatusColor(actionModal?.booking.status || "")}>
                  {actionModal?.booking.status || "-"}
                </Tag>
              ),
            },
            {
              key: "purpose",
              label: "Purpose",
              children: actionModal?.booking.purpose || "-",
            },
            {
              key: "note",
              label: "Note",
              children: actionModal?.booking.note || "-",
            },
          ]}
        />
      </Modal>

      <Modal
        open={!!feedbackModal}
        onCancel={closeFeedbackModal}
        width={760}
        title={
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-sky-600" />
            <span>Feedback after return room</span>
          </div>
        }
        okText="Submit feedback"
        cancelText="Skip"
        onOk={handleSubmitFeedback}
        okButtonProps={{ loading: submittingFeedback }}
        cancelButtonProps={{ disabled: submittingFeedback }}
      >
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4 md:p-5">
          <p className="mb-4 text-sm text-slate-600 md:text-base">
            Share your experience about the meeting room you just used.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MapPinIcon className="h-4 w-4 text-sky-600" />
                Booking details
              </h4>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPinIcon className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="font-medium text-slate-800">
                      {feedbackModal?.booking.locationCode || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <ClockIcon className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Start time</p>
                    <p className="font-medium text-slate-800">
                      {formatDateTime(feedbackModal?.booking.startTime || "")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <ClockIcon className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">End time</p>
                    <p className="font-medium text-slate-800">
                      {formatDateTime(feedbackModal?.booking.endTime || "")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <StarIcon className="h-4 w-4 text-amber-500" />
                Your rating
              </h4>

              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <Rate value={feedbackRating} onChange={setFeedbackRating} />
                <p className="mt-2 text-xs text-slate-600">
                  Satisfaction level:{" "}
                  <span className="font-semibold">{feedbackRating}/5</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ChatBubbleLeftRightIcon className="h-4 w-4 text-sky-600" />
              Feedback description
            </label>
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="Enter your feedback"
              value={feedbackDescription}
              onChange={(event) => setFeedbackDescription(event.target.value)}
            />
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
