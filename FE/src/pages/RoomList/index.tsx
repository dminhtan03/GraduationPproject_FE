import React, { useCallback, useEffect, useState } from "react";
import { Typography, Table, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { roomService } from "../../services/roomService";
import type { Room, RoomStatus } from "../../types";

const { Title, Text } = Typography;

type FilterType = "all" | "available" | "large";

const PAGE_SIZE = 10;

const DashboardPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await roomService.getRooms({
        page,
        size: PAGE_SIZE,
        status: filter === "available" ? "AVAILABLE" : undefined,
        minCapacity: filter === "large" ? 20 : undefined,
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

  const columns: ColumnsType<Room> = [
    {
      title: "ROOM NAME",
      dataIndex: "roomName",
      key: "roomName",
      render: (name: string, record: Room) => (
        <div>
          <div className="font-semibold text-gray-800">{name}</div>
          {record.floorInfo && (
            <div className="text-xs text-gray-500">{record.floorInfo}</div>
          )}
        </div>
      ),
      width: "40%",
    },
    {
      title: "BUILDING",
      dataIndex: "building",
      key: "building",
      width: "40%",
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "15%",
      render: (status: RoomStatus) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold
            ${
              status === "AVAILABLE"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-600"
            }`}
        >
          {status}
        </span>
      ),
    },
    {
      title: "ACTION",
      key: "action",
      width: "10%",
      render: (_: unknown, record: Room) => {
        const isAvailable = record.status === "AVAILABLE";
        const label = isAvailable ? "Book" : "View";

        return (
          <button
            type="button"
            className={`px-4 py-1 rounded-full text-xs font-semibold transition
              ${
                isAvailable
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
          >
            {label}
          </button>
        );
      },
    },
  ];

  // Search state for table
  const [tableSearch, setTableSearch] = useState("");
  const filteredRooms = rooms.filter(
    (r) =>
      r.roomName.toLowerCase().includes(tableSearch.trim().toLowerCase()) ||
      (r.building &&
        r.building.toLowerCase().includes(tableSearch.trim().toLowerCase())),
  );

  const pagedRooms = filteredRooms.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <Title level={2} className="!mb-1 text-gray-800 font-semibold">
          Campus Room Inventory
        </Title>
        <Text className="text-gray-500">
          Real-time availability across all university wings
        </Text>
      </div>

      {/* Filter + Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex gap-3">
          {["all", "available", "large"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f as FilterType);
                setPage(0);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition
                ${
                  filter === f
                    ? "bg-orange-500 text-white shadow"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              {f === "all"
                ? "All Rooms"
                : f === "available"
                  ? "Available Only"
                  : "Large (20+)"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by room or building..."
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {error && (
        <Alert
          message="Unable to load room data"
          description={error}
          type="error"
          showIcon
          className="mb-6"
        />
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table<Room>
            columns={columns}
            dataSource={pagedRooms}
            rowKey="id"
            loading={loading}
            pagination={false}
            scroll={{ x: 800 }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        <Text className="text-gray-500 text-sm">
          Showing {loading ? 0 : start}–{loading ? 0 : end} of {total}
        </Text>

        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >
            &lt;
          </button>
          <button
            disabled={end >= total}
            onClick={() => setPage((p) => p + 1)}
            className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
