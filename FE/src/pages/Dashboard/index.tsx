// ===== DASHBOARD PAGE – Campus Room Inventory =====
// Data: Room list from system. Replace mock with API when BE ready:
//   api.get(API_ENDPOINTS.ROOMS.LIST, { params: { page, size, status, minCapacity } })

import React, { useCallback, useEffect, useState } from "react";
import { Typography, Table, Button, Tag, Space, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { fetchMockRoomList, MOCK_TOTAL_ROOMS } from "../../utils/mockData";
import type { Room, RoomStatus } from "../../types";

const { Title, Text } = Typography;

type FilterType = "all" | "available" | "large";

const PAGE_SIZE = 5;

const DashboardPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(MOCK_TOTAL_ROOMS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with BE API – e.g. api.get(API_ENDPOINTS.ROOMS.LIST, { params: { page, size: PAGE_SIZE, status, minCapacity } })
      const res = await fetchMockRoomList({
        page,
        pageSize: PAGE_SIZE,
        status: filter === "available" ? "AVAILABLE" : "all",
        minCapacity: filter === "large" ? 20 : undefined,
        simulateFail: false, // Set true to test "Unable to load room data"
      });
      setRooms(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load room data");
      setRooms([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const onFilterChange = (f: FilterType) => {
    setFilter(f);
    setPage(0);
  };

  const onBook = (room: Room) => {
    if (room.status === "OCCUPIED") return;
    // TODO: Navigate to booking flow or open modal
    console.log("Book room:", room.id);
  };

  const onView = (room: Room) => {
    // TODO: Navigate to room detail or open modal
    console.log("View room:", room.id);
  };

  const columns: ColumnsType<Room> = [
    {
      title: "ROOM NAME",
      dataIndex: "roomName",
      key: "roomName",
      render: (name: string, record: Room) => (
        <div>
          <Text strong>{name}</Text>
          {record.floorInfo && (
            <div className="text-xs text-gray-500">{record.floorInfo}</div>
          )}
        </div>
      ),
    },
    {
      title: "BUILDING",
      dataIndex: "building",
      key: "building",
    },
    {
      title: "CAP.",
      dataIndex: "slot",
      key: "slot",
      width: 80,
      align: "center",
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: RoomStatus) => (
        <Tag color={status === "AVAILABLE" ? "green" : "red"}>
          {status === "AVAILABLE" ? "AVAILABLE" : "OCCUPIED"}
        </Tag>
      ),
    },
    {
      title: "ACTION",
      key: "action",
      width: 160,
      render: (_, record: Room) => (
        <Space>
          <Button
            type="primary"
            size="small"
            disabled={record.status === "OCCUPIED"}
            onClick={() => onBook(record)}
            style={{
              background: record.status === "AVAILABLE" ? "#ff9500" : undefined,
              borderColor: "#ff9500",
            }}
          >
            Book
          </Button>
          <Button type="link" size="small" onClick={() => onView(record)}>
            View
          </Button>
        </Space>
      ),
    },
  ];

  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="fade-in">
      <div className="mb-6">
        <Title level={2} className="mb-1">
          Campus Room Inventory
        </Title>
        <Text className="text-gray-600">
          Real-time availability across all university wings
        </Text>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          type={filter === "all" ? "primary" : "default"}
          onClick={() => onFilterChange("all")}
          style={
            filter === "all"
              ? { background: "#ff9500", borderColor: "#ff9500" }
              : undefined
          }
        >
          All Rooms
        </Button>
        <Button
          type={filter === "available" ? "primary" : "default"}
          onClick={() => onFilterChange("available")}
          style={
            filter === "available"
              ? { background: "#ff9500", borderColor: "#ff9500" }
              : undefined
          }
        >
          Available Only
        </Button>
        <Button
          type={filter === "large" ? "primary" : "default"}
          onClick={() => onFilterChange("large")}
          style={
            filter === "large"
              ? { background: "#ff9500", borderColor: "#ff9500" }
              : undefined
          }
        >
          Large (20+)
        </Button>
      </div>

      {/* Error state: Unable to load room data */}
      {error && (
        <Alert
          message="Unable to load room data"
          description={error}
          type="error"
          showIcon
          className="mb-4"
          action={
            <Button size="small" onClick={loadRooms}>
              Retry
            </Button>
          }
        />
      )}

      {/* Table */}
      <Table<Room>
        columns={columns}
        dataSource={rooms}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
      />

      {/* Pagination at bottom */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
        <Text className="text-gray-600">
          Showing {loading ? "0" : start}–{loading ? "0" : end} of {total} rooms
        </Text>
        <Space>
          <Button
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            &lt;
          </Button>
          <Button
            disabled={end >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            &gt;
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default DashboardPage;
