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
  InputNumber,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table";
import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { reservationService } from "../../services/reservationService";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { Reservation } from "../../types";

const { Title, Paragraph } = Typography;

type BookingTabKey = "history" | "ongoing";
type BookingActionType = "check-in" | "return-room" | "extend" | "cancel";

interface BookingActionModalState {
  type: BookingActionType;
  booking: Reservation;
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
  if (["IN_USE", "CHECKED_IN", "CANCELLED", "COMPLETED", "REJECTED"].includes(normalized)) {
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

const canCancel = (status: string, startTime?: string, endTime?: string) => {
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
  if (["IN_USE", "CHECKED_IN", "CANCELLED", "COMPLETED", "REJECTED"].includes(status)) {
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

const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BookingTabKey>("ongoing");
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<BookingActionModalState | null>(null);
  const [extendHour, setExtendHour] = useState<number>(1);

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

  const openActionModal = (type: BookingActionType, booking: Reservation) => {
    if (type === "extend") {
      setExtendHour(1);
    }
    setActionModal({ type, booking });
  };

  const closeActionModal = () => {
    setActionModal(null);
  };

  const handleConfirmAction = async () => {
    if (!actionModal?.booking?.id) return;

    const reservationId = actionModal.booking.id;
    const status = actionModal.booking.status || "";

    if (
      actionModal.type === "check-in" &&
      !canCheckIn(status, actionModal.booking.startTime, actionModal.booking.endTime)
    ) {
      message.warning("Chỉ được check-in trong khoảng thời gian đã đặt phòng.");
      return;
    }

    if (
      actionModal.type === "return-room" &&
      !canCheckOut(status, actionModal.booking.startTime, actionModal.booking.endTime)
    ) {
      message.warning("Chỉ có thể trả phòng khi cuộc họp đang diễn ra.");
      return;
    }

    if (
      actionModal.type === "extend" &&
      !canExtend(status, actionModal.booking.startTime, actionModal.booking.endTime)
    ) {
      message.warning("Chỉ có thể gia hạn khi cuộc họp đang diễn ra.");
      return;
    }

    if (
      actionModal.type === "cancel" &&
      !canCancel(status, actionModal.booking.startTime, actionModal.booking.endTime)
    ) {
      message.warning("Chỉ có thể hủy booking trước khi cuộc họp bắt đầu.");
      return;
    }

    setLoading(true);
    setActionLoadingId(reservationId);
    try {
      if (actionModal.type === "check-in") {
        await reservationService.checkInBooking(reservationId);
        message.success("Check-in thành công");
      } else if (actionModal.type === "return-room") {
        await reservationService.returnRoomBooking(reservationId);
        message.success("Trả phòng thành công");
      } else if (actionModal.type === "extend") {
        await reservationService.extendRoomBooking(reservationId, extendHour);
        message.success(`Gia hạn phòng thêm ${extendHour} giờ thành công`);
      } else {
        await reservationService.cancelBooking(reservationId);
        message.success("Hủy booking thành công");
      }

      closeActionModal();
      await loadBookings(page, pageSize, activeTab);
    } catch (err) {
      message.error(
        extractApiMessage(
          err,
          actionModal.type === "check-in"
            ? "Không thể check-in booking"
            : actionModal.type === "return-room"
              ? "Không thể trả phòng"
              : actionModal.type === "extend"
                ? "Không thể gia hạn phòng"
                : "Không thể hủy booking",
        ),
      );
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
            <span className="font-medium text-gray-700">{formatDatePart(record.startTime)}</span>
            <Tag color="blue">{formatTimePart(record.startTime)}</Tag>
          </div>
          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-orange-500" />
            <span className="text-gray-500 min-w-[40px]">End</span>
            <span className="font-medium text-gray-700">{formatDatePart(record.endTime)}</span>
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
        const checkInEnabled = canCheckIn(status, record.startTime, record.endTime);
        const returnRoomEnabled = canCheckOut(status, record.startTime, record.endTime);
        const extendEnabled = canExtend(status, record.startTime, record.endTime);
        const cancelEnabled = canCancel(status, record.startTime, record.endTime);
        const checkInDisabledReason = getCheckInDisabledReason(record);
        const returnRoomDisabledReason = getCheckOutDisabledReason(record);
        const extendDisabledReason = getExtendDisabledReason(record);
        const cancelDisabledReason = getCancelDisabledReason(record);

        return (
          <Space>
            <Tooltip title={!checkInEnabled ? checkInDisabledReason : undefined}>
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

            <Tooltip title={!returnRoomEnabled ? returnRoomDisabledReason : undefined}>
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
          image={<CalendarOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />}
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
        okButtonProps={{ loading: !!actionModal?.booking?.id && actionLoadingId === actionModal.booking.id }}
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
              onChange={(value) => setExtendHour(typeof value === "number" ? value : 1)}
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
              children: <Tag color={getStatusColor(actionModal?.booking.status || "")}>{actionModal?.booking.status || "-"}</Tag>,
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
    </div>
  );
};

export default MyBookingsPage;
