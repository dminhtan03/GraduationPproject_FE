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
import { reservationService } from "../../services/reservationService";
import { feedbackService } from "../../services/feedbackService";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { Reservation, WebSocketMessage } from "../../types";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { useWebSocket } from "../../hooks/useWebSocket";

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

const TAB_STATUS_FILTERS: Record<BookingTabKey, string[]> = {
  ongoing: ["PENDING", "APPROVED", "IN_USE", "CHECKED_IN"],
  history: ["COMPLETED", "CANCELLED", "REJECTED", "FAILED"],
};

const filterItemsByTab = (items: Reservation[], tabKey: BookingTabKey) => {
  const historyStatuses = TAB_STATUS_FILTERS.history;

  if (tabKey === "history") {
    return items.filter((item) =>
      historyStatuses.includes((item.status || "").toUpperCase()),
    );
  }

  return items.filter(
    (item) => !historyStatuses.includes((item.status || "").toUpperCase()),
  );
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
  if (normalized === "PENDING") return "gold";
  if (normalized === "APPROVED") return "green";
  if (normalized === "IN_USE" || normalized === "CHECKED_IN") return "blue";
  if (normalized === "COMPLETED") return "cyan";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "REJECTED") return "volcano";
  if (normalized === "FAILED") return "magenta";
  return "default";
};

const isValidDate = (value?: string) => {
  return parseBookingDateTime(value) !== null;
};

const canCheckIn = (status: string, startTime?: string, endTime?: string) => {
  const normalized = status.toUpperCase();
  if (
    ["IN_USE", "CHECKED_IN", "CANCELLED", "COMPLETED", "REJECTED"].includes(
      normalized,
    )
  ) {
    return false;
  }
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const now = new Date();
  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);

  if (!start || !end) return false;
  return now >= start && now <= end;
};

const canCheckOut = (status: string, startTime?: string, endTime?: string) => {
  const normalized = status.toUpperCase();
  if (!["IN_USE", "CHECKED_IN"].includes(normalized)) return false;
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const now = new Date();
  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);
  if (!start || !end) return false;

  return now >= start && now <= end;
};

const canExtend = (status: string, startTime?: string, endTime?: string) => {
  const normalized = status.toUpperCase();
  if (!["IN_USE", "CHECKED_IN"].includes(normalized)) return false;
  if (!isValidDate(startTime) || !isValidDate(endTime)) return false;

  const now = new Date();
  const start = parseBookingDateTime(startTime);
  const end = parseBookingDateTime(endTime);
  if (!start || !end) return false;

  return now >= start && now <= end;
};

const canCancel = (status: string, startTime?: string) => {
  const normalized = status.toUpperCase();
  if (["CANCELLED", "COMPLETED", "REJECTED"].includes(normalized)) return false;

  const start = parseBookingDateTime(startTime);
  if (!start) return false;

  const now = new Date();
  return now < start;
};

const getCheckInDisabledReason = (record: Reservation) => {
  if (!record.id) return "Không thể thao tác vì thiếu mã booking từ API.";

  const status = (record.status || "").toUpperCase();
  if (
    ["IN_USE", "CHECKED_IN", "CANCELLED", "COMPLETED", "REJECTED"].includes(
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

  const now = new Date();
  if (now < start) {
    return `Chưa đến thời gian check-in. Bắt đầu lúc ${formatDateTime(record.startTime || "")}.`;
  }
  if (now > end) {
    return "Đã quá thời gian booking nên không thể check-in.";
  }
  return undefined;
};

const getCancelDisabledReason = (record: Reservation) => {
  if (!record.id) return "Không thể thao tác vì thiếu mã booking từ API.";

  const status = (record.status || "").toUpperCase();
  if (["CANCELLED", "COMPLETED", "REJECTED"].includes(status)) {
    return `Booking đang ở trạng thái ${status || "N/A"} nên không thể hủy.`;
  }

  const start = parseBookingDateTime(record.startTime);
  if (!start) {
    return "Thiếu thời gian bắt đầu từ API nên không thể xác định quyền hủy.";
  }

  const now = new Date();
  if (now >= start) {
    return "Chỉ có thể hủy booking trước khi cuộc họp bắt đầu.";
  }
  return undefined;
};

const getCheckOutDisabledReason = (record: Reservation) => {
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

  const now = new Date();
  if (now < start || now > end) {
    return "Chỉ có thể trả phòng khi cuộc họp đang diễn ra.";
  }

  return undefined;
};

const getExtendDisabledReason = (record: Reservation) => {
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

  const now = new Date();
  if (now < start || now > end) {
    return "Chỉ có thể gia hạn khi cuộc họp đang diễn ra.";
  }

  return undefined;
};

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

  const showToast = (type: MessageType, nextMessage: string) => {
    setToastPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setToastPopup((current) =>
        current && current.message === nextMessage ? null : current,
      );
    }, 3000);
  };

  const loadBookings = useCallback(
    async (nextPage: number, nextSize: number, tabKey: BookingTabKey) => {
      setLoading(true);
      setError(null);
      try {
        try {
          const result = await reservationService.getMyBookings({
            page: Math.max(nextPage - 1, 0),
            size: nextSize,
            statuses: TAB_STATUS_FILTERS[tabKey],
          });
          setBookings(result.items);
          setTotal(result.total);
        } catch {
          const fallbackResult = await reservationService.getMyBookings({
            page: Math.max(nextPage - 1, 0),
            size: nextSize,
          });
          const filteredItems = filterItemsByTab(fallbackResult.items, tabKey);
          setBookings(filteredItems);
          setTotal(filteredItems.length);
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
    [],
  );

  useEffect(() => {
    loadBookings(1, 5, "ongoing");
  }, [loadBookings]);

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
    void loadBookings(page, pageSize, activeTab);
  }, [activeTab, lastMessage, loadBookings, page, pageSize]);

  const openActionModal = (type: BookingActionType, booking: Reservation) => {
    setActionModalError(null);
    if (type === "extend") {
      setExtendHour(1);
    }
    setActionModal({ type, booking });
  };

  const closeActionModal = () => {
    setActionModalError(null);
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
      await loadBookings(page, pageSize, activeTab);
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

    if (
      currentAction.type === "check-in" &&
      !canCheckIn(
        status,
        currentAction.booking.startTime,
        currentAction.booking.endTime,
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
      )
    ) {
      message.warning("Chỉ có thể gia hạn khi cuộc họp đang diễn ra.");
      return;
    }

    if (
      currentAction.type === "cancel" &&
      !canCancel(status, currentAction.booking.startTime)
    ) {
      message.warning("Chỉ có thể hủy booking trước khi cuộc họp bắt đầu.");
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
        actionResponse = await reservationService.cancelBooking(reservationId);
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

      closeActionModal();
      if (currentAction.type === "return-room") {
        openFeedbackModal(currentAction.booking);
      }
      await loadBookings(page, pageSize, activeTab);
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
    loadBookings(1, pageSize, nextTab);
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const nextPage = pagination.current || 1;
    const nextSize = pagination.pageSize || pageSize;
    loadBookings(nextPage, nextSize, activeTab);
  };

  const tabItems = useMemo(
    () => [
      { key: "ongoing", label: "On-going / In-coming Meeting" },
      { key: "history", label: "Booking History" },
    ],
    [],
  );

  const columns: ColumnsType<Reservation> = [
    {
      title: "LOCATION CODE",
      dataIndex: "locationCode",
      key: "locationCode",
      width: "17%",
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "FLOOR",
      dataIndex: "floor",
      key: "floor",
      width: "10%",
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "ADDRESS",
      dataIndex: "address",
      key: "address",
      width: "17%",
      render: (value: string | undefined) => value || "-",
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
        );
        const returnRoomEnabled = canCheckOut(
          status,
          record.startTime,
          record.endTime,
        );
        const extendEnabled = canExtend(
          status,
          record.startTime,
          record.endTime,
        );
        const cancelEnabled = canCancel(status, record.startTime);
        const checkInDisabledReason = getCheckInDisabledReason(record);
        const returnRoomDisabledReason = getCheckOutDisabledReason(record);
        const extendDisabledReason = getExtendDisabledReason(record);
        const cancelDisabledReason = getCancelDisabledReason(record);

        return (
          <Space>
            <Tooltip
              title={!checkInEnabled ? checkInDisabledReason : undefined}
            >
              <span>
                <Button
                  type="primary"
                  size="small"
                  loading={isLoading && checkInEnabled}
                  disabled={!record.id || !checkInEnabled}
                  onClick={() => openActionModal("check-in", record)}
                >
                  Check-in
                </Button>
              </span>
            </Tooltip>

            <Tooltip
              title={!returnRoomEnabled ? returnRoomDisabledReason : undefined}
            >
              <span>
                <Button
                  size="small"
                  loading={isLoading && returnRoomEnabled}
                  disabled={!record.id || !returnRoomEnabled}
                  onClick={() => openActionModal("return-room", record)}
                >
                  Return room
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={!extendEnabled ? extendDisabledReason : undefined}>
              <span>
                <Button
                  size="small"
                  loading={isLoading && extendEnabled}
                  disabled={!record.id || !extendEnabled}
                  onClick={() => openActionModal("extend", record)}
                >
                  Extend
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={!cancelEnabled ? cancelDisabledReason : undefined}>
              <span>
                <Button
                  danger
                  size="small"
                  loading={isLoading && cancelEnabled}
                  disabled={!record.id || !cancelEnabled}
                  onClick={() => openActionModal("cancel", record)}
                >
                  Cancel
                </Button>
              </span>
            </Tooltip>
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

      <div className="mb-4 flex gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.ROOM_LIST)}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
        >
          Book a room
        </button>
        <button
          type="button"
          onClick={() => loadBookings(page, pageSize, activeTab)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
          disabled={loading}
        >
          Refresh
        </button>
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
              key: "address",
              label: "Address",
              children: actionModal?.booking.address || "-",
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
