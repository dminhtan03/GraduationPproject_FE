import React, { useCallback, useEffect, useState } from "react";
import { Typography, Empty, Table, Tag, Alert, Button, Popconfirm, Space, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table";
import { CalendarOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { reservationService } from "../../services/reservationService";
import type { Reservation } from "../../types";

const { Title, Paragraph } = Typography;

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

const getStatusColor = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "PENDING") return "gold";
  if (normalized === "APPROVED") return "green";
  if (normalized === "IN_USE" || normalized === "CHECKED_IN") return "blue";
  if (normalized === "COMPLETED") return "cyan";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "REJECTED") return "volcano";
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

const canCancel = (status: string, startTime?: string, endTime?: string) => {
  const normalized = status.toUpperCase();
  if (["CANCELLED", "COMPLETED", "REJECTED"].includes(normalized)) return false;

  const start = parseBookingDateTime(startTime);
  if (!start) return false;

  const now = new Date();
  return now < start;
};

const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadBookings = useCallback(async (nextPage = page, nextSize = pageSize) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reservationService.getMyBookings({
        page: Math.max(nextPage - 1, 0),
        size: nextSize,
      });
      setBookings(result.items);
      setTotal(result.total);
      setPage(result.page + 1);
      setPageSize(result.size);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bookings");
      setBookings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadBookings(1, pageSize);
  }, [loadBookings]);

  const handleCheckIn = async (record: Reservation) => {
    const reservationId = record.id;
    if (!reservationId) return;

    if (!canCheckIn(record.status || "", record.startTime, record.endTime)) {
      message.warning("Chỉ được check-in trong khoảng thời gian đã đặt phòng.");
      return;
    }

    setActionLoadingId(reservationId);
    try {
      await reservationService.checkInBooking(reservationId);
      message.success("Check-in thành công");
      await loadBookings(page, pageSize);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Không thể check-in booking");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelBooking = async (record: Reservation) => {
    const reservationId = record.id;
    if (!reservationId) return;

    if (!canCancel(record.status || "", record.startTime, record.endTime)) {
      message.warning("Chỉ có thể hủy booking trước khi cuộc họp bắt đầu.");
      return;
    }

    setActionLoadingId(reservationId);
    try {
      await reservationService.cancelBooking(reservationId);
      message.success("Hủy booking thành công");
      await loadBookings(page, pageSize);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Không thể hủy booking");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const nextPage = pagination.current || 1;
    const nextSize = pagination.pageSize || pageSize;
    loadBookings(nextPage, nextSize);
  };

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
      width: "22%",
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "TIME",
      key: "time",
      width: "24%",
      render: (_: unknown, record: Reservation) => (
        <div className="text-xs">
          <div>From: {formatDateTime(record.startTime || "")}</div>
          <div>To: {formatDateTime(record.endTime || "")}</div>
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
      width: "20%",
      render: (_: unknown, record: Reservation) => {
        const status = record.status || "";
        const isLoading = actionLoadingId === record.id;
        const checkInEnabled = canCheckIn(status, record.startTime, record.endTime);
        const cancelEnabled = canCancel(status, record.startTime, record.endTime);

        return (
          <Space>
            <Popconfirm
              title="Xác nhận check-in?"
              description="Chỉ check-in được trong khoảng thời gian đã đặt phòng."
              onConfirm={() => handleCheckIn(record)}
              okText="Check-in"
              cancelText="Đóng"
              disabled={!record.id || !checkInEnabled}
            >
              <Button
                type="primary"
                size="small"
                loading={isLoading && checkInEnabled}
                disabled={!record.id || !checkInEnabled}
              >
                Check-in
              </Button>
            </Popconfirm>

            <Popconfirm
              title="Xác nhận hủy booking?"
              description="Thao tác này không thể hoàn tác."
              onConfirm={() => handleCancelBooking(record)}
              okText="Hủy booking"
              cancelText="Đóng"
              okButtonProps={{ danger: true }}
              disabled={!record.id || !cancelEnabled}
            >
              <Button
                danger
                size="small"
                loading={isLoading && cancelEnabled}
                disabled={!record.id || !cancelEnabled}
              >
                Cancel
              </Button>
            </Popconfirm>
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
          onClick={() => loadBookings(page, pageSize)}
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
          description="No bookings yet. Book a room from the Room List."
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
    </div>
  );
};

export default MyBookingsPage;
