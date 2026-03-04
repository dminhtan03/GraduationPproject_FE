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
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
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
      title: "LOCATION CODE",
      dataIndex: "locationCode",
      key: "locationCode",
      width: "20%",
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "ADDRESS",
      dataIndex: "address",
      key: "address",
      width: "26%",
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "TIME",
      key: "time",
      width: "34%",
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
      width: "20%",
      render: (status: string | undefined) => (
        <Tag color={getStatusColor(status || "")}>{status || "-"}</Tag>
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
