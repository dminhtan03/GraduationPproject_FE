import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Typography, Table, Alert, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { roomService } from "../../services/roomService";
import type { Room, RoomStatus } from "../../types";
import { ROUTES } from "../../constants";
import { extractApiMessage } from "../../utils/errorHandlers";

const { Title, Text } = Typography;

const PAGE_SIZE = 10;

type RoomFilter = "all" | "available" | "unavailable";

type RoomListItem = Room & {
  buildingId: string;
  floorId: string;
};

type BuildingNode = {
  buildingId: string;
  buildingName: string;
  floors?: FloorNode[];
};

type FloorNode = {
  floorId: string;
  floorName: string;
  rooms?: Array<{
    roomId?: string;
    id?: string;
    locationCode?: string;
    roomName?: string;
    slot?: number;
    status?: string;
  }>;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, "0"),
  label: `${String(hour).padStart(2, "0")}h`,
}));

const MINUTE_OPTIONS = ["10", "20", "30", "40", "50"];

const buildDateTime = (date: string, hour: string, minute: string) => {
  if (!date || !hour || !minute) return "";
  return `${date}T${hour}:${minute}:00`;
};

const normalizeLocalDateTime = (value: string) => {
  if (!value) return "";
  return value.length === 16 ? `${value}:00` : value;
};

const toBackendStatus = (filter: RoomFilter): RoomStatus | undefined => {
  if (filter === "available") return "AVAILABLE";
  if (filter === "unavailable") return "OCCUPIED";
  return undefined;
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [allRooms, setAllRooms] = useState<RoomListItem[]>([]);
  const [buildings, setBuildings] = useState<BuildingNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("08");
  const [startMinute, setStartMinute] = useState("10");
  const [endDate, setEndDate] = useState("");
  const [endHour, setEndHour] = useState("09");
  const [endMinute, setEndMinute] = useState("10");

  const loadRoomMapData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await roomService.getRoomsMap();
      const buildingNodes = Array.isArray(data.buildingResponse)
        ? (data.buildingResponse as BuildingNode[])
        : [];

      const flattened: RoomListItem[] = [];
      buildingNodes.forEach((building) => {
        (building.floors || []).forEach((floor) => {
          (floor.rooms || []).forEach((room) => {
            const rawStatus = (room.status || "").toUpperCase();
            flattened.push({
              id: String(room.roomId || room.id || ""),
              roomName: room.locationCode || room.roomName || "-",
              floorInfo: floor.floorName || "",
              building: building.buildingName || "",
              slot: Number(room.slot || 0),
              status: rawStatus === "AVAILABLE" ? "AVAILABLE" : "OCCUPIED",
              buildingId: building.buildingId,
              floorId: floor.floorId,
            });
          });
        });
      });

      setBuildings(buildingNodes);
      setAllRooms(flattened);

      const firstBuilding = buildingNodes[0];
      const firstFloor = firstBuilding?.floors?.[0];
      if (firstBuilding?.buildingId) {
        setSelectedBuildingId(firstBuilding.buildingId);
      }
      if (firstFloor?.floorId) {
        setSelectedFloorId(firstFloor.floorId);
      }

      const initialRooms = flattened.filter((room) => {
        if (!firstBuilding?.buildingId || !firstFloor?.floorId) return true;
        return (
          room.buildingId === firstBuilding.buildingId &&
          room.floorId === firstFloor.floorId
        );
      });

      setRooms(initialRooms);
      setPage(0);
    } catch (e: unknown) {
      const apiMessage = extractApiMessage(e, "Unable to load room data");
      setError(apiMessage);
      message.error(apiMessage);
      setRooms([]);
      setAllRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoomMapData();
  }, [loadRoomMapData]);

  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.buildingId === selectedBuildingId) || null,
    [buildings, selectedBuildingId],
  );

  const floors = useMemo(() => selectedBuilding?.floors || [], [selectedBuilding]);

  useEffect(() => {
    if (!selectedBuildingId) return;
    const firstFloorId = floors[0]?.floorId || "";
    if (!selectedFloorId || !floors.some((floor) => floor.floorId === selectedFloorId)) {
      setSelectedFloorId(firstFloorId);
    }
  }, [floors, selectedBuildingId, selectedFloorId]);

  useEffect(() => {
    if (!selectedBuildingId || !selectedFloorId) return;

    const scopedRooms = allRooms.filter(
      (room) =>
        room.buildingId === selectedBuildingId && room.floorId === selectedFloorId,
    );

    const status = toBackendStatus(filter);
    setRooms(status ? scopedRooms.filter((room) => room.status === status) : scopedRooms);
    setPage(0);
  }, [allRooms, filter, selectedBuildingId, selectedFloorId]);

  const columns: ColumnsType<Room> = [
    {
      title: "ROOM NAME",
      dataIndex: "roomName",
      key: "roomName",
      width: "40%",
      render: (name: string, record: Room) => (
        <div>
          <div className="font-semibold text-gray-800">{name}</div>
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
      width: "26%",
    },
    {
      title: "CAP.",
      dataIndex: "slot",
      key: "slot",
      width: "10%",
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "14%",
      render: (status: RoomStatus) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
            className={`px-4 py-1 rounded-full text-xs font-semibold transition ${
              isAvailable
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => {
              navigate(ROUTES.BOOK_ROOM.replace(":roomId", record.id), {
                state: { room: record },
              });
            }}
          >
            {label}
          </button>
        );
      },
    },
  ];

  const filteredRooms = useMemo(() => rooms, [rooms]);

  const pagedRooms = filteredRooms.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalFiltered = filteredRooms.length;
  const start = totalFiltered === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalFiltered);

  const handleApplyFilters = async () => {
    const startTime = buildDateTime(startDate, startHour, startMinute);
    const endTime = buildDateTime(endDate, endHour, endMinute);

    if (!startTime && !endTime) {
      if (!selectedBuildingId || !selectedFloorId) {
        const msg = "Please select building and floor.";
        setError(msg);
        message.warning(msg);
        return;
      }

      const scopedRooms = allRooms.filter(
        (room) =>
          room.buildingId === selectedBuildingId && room.floorId === selectedFloorId,
      );
      const status = toBackendStatus(filter);
      setRooms(status ? scopedRooms.filter((room) => room.status === status) : scopedRooms);
      setPage(0);
      return;
    }

    if (!startTime || !endTime) {
      const msg = "Please select both start and end time.";
      setError(msg);
      message.warning(msg);
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      const msg = "End time must be later than start time.";
      setError(msg);
      message.warning(msg);
      return;
    }

    if (!selectedBuildingId || !selectedFloorId) {
      const msg = "Please select building and floor.";
      setError(msg);
      message.warning(msg);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const availableRooms = await roomService.searchAvailableRooms({
        buildingId: selectedBuildingId,
        floorId: selectedFloorId,
        startTime: normalizeLocalDateTime(startTime),
        endTime: normalizeLocalDateTime(endTime),
      });

      const availableSet = new Set(
        availableRooms.map((item) => String(item.roomId || "")).filter(Boolean),
      );

      const scopedRooms = allRooms
        .filter(
          (room) =>
            room.buildingId === selectedBuildingId && room.floorId === selectedFloorId,
        )
        .map((room) => ({
          ...room,
          status: (availableSet.has(room.id) ? "AVAILABLE" : "OCCUPIED") as RoomStatus,
        }));

      const status = toBackendStatus(filter);
      setRooms(status ? scopedRooms.filter((room) => room.status === status) : scopedRooms);
      setPage(0);
    } catch (e: unknown) {
      const apiMessage = extractApiMessage(e, "Unable to apply time filter");
      setError(apiMessage);
      message.error(apiMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Title level={2} className="!mb-1 text-gray-800 font-semibold">
            Campus Room Inventory
          </Title>
          <Text className="text-gray-500">
            Real-time availability across all university wings
          </Text>
        </div>
        <button
          type="button"
          onClick={() => navigate("/room-map")}
          className="self-start px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium shadow hover:bg-orange-600"
        >
          Show Room Map
        </button>
      </div>

      <div className="mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase mb-1">
                  Building
                </div>
                <select
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {buildings.map((building) => (
                    <option key={building.buildingId} value={building.buildingId}>
                      {building.buildingName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase mb-1">
                  Floor
                </div>
                <select
                  value={selectedFloorId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {floors.map((floor) => (
                    <option key={floor.floorId} value={floor.floorId}>
                      {floor.floorName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase mb-1">
                  Status
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as RoomFilter)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="all">All</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Occupied</option>
                </select>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase mb-1">
                Time range
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <div className="text-[10px] font-semibold tracking-wide uppercase text-slate-500 mb-1.5">
                    Start
                  </div>
                  <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="w-full min-w-[84px] border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {HOUR_OPTIONS.map((hour) => (
                        <option key={hour.value} value={hour.value}>
                          {hour.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={startMinute}
                      onChange={(e) => setStartMinute(e.target.value)}
                      className="w-full min-w-[84px] border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {MINUTE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}m
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <div className="text-[10px] font-semibold tracking-wide uppercase text-slate-500 mb-1.5">
                    End
                  </div>
                  <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className="w-full min-w-[84px] border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {HOUR_OPTIONS.map((hour) => (
                        <option key={hour.value} value={hour.value}>
                          {hour.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={endMinute}
                      onChange={(e) => setEndMinute(e.target.value)}
                      className="w-full min-w-[84px] border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {MINUTE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}m
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex xl:justify-end xl:items-end">
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={loading}
              className="w-full xl:w-auto inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FunnelIcon className="w-4 h-4" />
              <span>Apply filters</span>
            </button>
          </div>
        </div>
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
        <Table<Room>
          columns={columns}
          dataSource={pagedRooms}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </div>

      <div className="flex justify-between items-center mt-6">
        <Text className="text-gray-500 text-sm">
          Showing {loading ? 0 : start}–{loading ? 0 : end} of {totalFiltered}
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
            disabled={end >= totalFiltered}
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
