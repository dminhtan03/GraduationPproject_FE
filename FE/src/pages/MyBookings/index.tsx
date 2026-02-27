import React, { useCallback, useEffect, useState } from "react";
import { Typography, Empty, Table, Tag, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table";
import { CalendarOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { reservationService } from "../../services/reservationService";
import type { Reservation } from "../../types";

const { Title, Paragraph } = Typography;

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const getStatusColor = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "APPROVED" || normalized === "COMPLETED") return "green";
  if (normalized === "PENDING") return "gold";
  if (normalized === "REJECTED" || normalized === "CANCELLED") return "red";
  return "default";
};

const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);

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

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const nextPage = pagination.current || 1;
    const nextSize = pagination.pageSize || pageSize;
    loadBookings(nextPage, nextSize);
  };

  const columns: ColumnsType<Reservation> = [
    {
      title: "ROOM",
      key: "room",
      render: (_: unknown, record: Reservation) => (
        <div>
          <div className="font-semibold text-gray-800">{record.roomName}</div>
          <div className="text-xs text-gray-500">{record.building}</div>
        </div>
      ),
      width: "26%",
    },
    {
      title: "PURPOSE",
      dataIndex: "purpose",
      key: "purpose",
      width: "20%",
      render: (value: string) => value || "-",
    },
    {
      title: "TIME",
      key: "time",
      width: "28%",
      render: (_: unknown, record: Reservation) => (
        <div className="text-xs">
          <div>From: {formatDateTime(record.startTime)}</div>
          <div>To: {formatDateTime(record.endTime)}</div>
        </div>
      ),
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "12%",
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status || "PENDING"}</Tag>
      ),
    },
    {
      title: "CREATED",
      dataIndex: "createdAt",
      key: "createdAt",
      width: "14%",
      render: (value: string) => (
        <span className="text-xs text-gray-500">{formatDateTime(value)}</span>
      ),
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
            rowKey="id"
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
