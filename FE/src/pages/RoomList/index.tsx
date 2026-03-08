import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Typography, Table, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { ClockIcon } from "@heroicons/react/24/outline";
import { roomService } from "../../services/roomService";
import { ROUTES } from "../../constants";
import { extractApiMessage } from "../../utils/errorHandlers";
import DatePickerField from "../../components/common/DatePickerField";

const { Title, Text } = Typography;

type RoomListStatus = "AVAILABLE" | "UNAVAILABLE" | "BROKEN";
type FilterType = "all" | "available" | "unavailable" | "broken";

interface RoomListItem {
  id: string;
  roomName: string;
  building: string;
  floorInfo?: string;
  status: RoomListStatus;
  buildingId: string;
  floorId: string;
}

interface RawMapRoom {
  roomId?: string;
  id?: string;
  locationCode?: string;
  roomName?: string;
  status?: string;
}

interface RawMapFloor {
  floorId: string;
  floorName?: string;
  rooms?: RawMapRoom[];
}

interface RawMapBuilding {
  buildingId: string;
  buildingName?: string;
  floors?: RawMapFloor[];
}

const PAGE_SIZE = 10;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, "0"),
  label: `${String(hour).padStart(2, "0")}h`,
}));

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentTimeRange = () => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    startDate: toDateInputValue(now),
    startHour: String(now.getHours()).padStart(2, "0"),
    startMinute: String(now.getMinutes()).padStart(2, "0"),
    endDate: toDateInputValue(oneHourLater),
    endHour: String(oneHourLater.getHours()).padStart(2, "0"),
    endMinute: String(oneHourLater.getMinutes()).padStart(2, "0"),
  };
};

const normalizeLocalDateTime = (value: string) => {
  if (!value) return "";
  // Align with BE LocalDateTime format used by /api/v1/rooms/search
  return value.length === 16 ? `${value}:00` : value;
};

const buildDateTime = (date: string, hour: string, minute: string) => {
  if (!date || !hour || !minute) return "";
  return `${date}T${hour}:${minute}:00`;
};

const getStatusBadgeClass = (status: RoomListStatus) => {
  if (status === "AVAILABLE") return "bg-green-100 text-green-700";
  if (status === "BROKEN") return "bg-slate-200 text-slate-700";
  return "bg-red-100 text-red-600";
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const currentTimeRange = useMemo(() => getCurrentTimeRange(), []);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedFloorId, setSelectedFloorId] = useState("all");
  const [startDate, setStartDate] = useState(currentTimeRange.startDate);
  const [startHour, setStartHour] = useState(currentTimeRange.startHour);
  const [startMinute, setStartMinute] = useState(currentTimeRange.startMinute);
  const [endDate, setEndDate] = useState(currentTimeRange.endDate);
  const [endHour, setEndHour] = useState(currentTimeRange.endHour);
  const [endMinute, setEndMinute] = useState(currentTimeRange.endMinute);
  const [timeFilterActive, setTimeFilterActive] = useState(false);
  const [timeStatusOverrides, setTimeStatusOverrides] = useState<
    Record<string, RoomListStatus>
  >({});

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mapData = await roomService.getRoomsMap();
      const buildings: RawMapBuilding[] = Array.isArray(
        mapData.buildingResponse,
      )
        ? (mapData.buildingResponse as RawMapBuilding[])
        : [];

      const flattened: RoomListItem[] = [];
      buildings.forEach((building) => {
        const floors = Array.isArray(building.floors) ? building.floors : [];
        floors.forEach((floor) => {
          const floorRooms = Array.isArray(floor.rooms) ? floor.rooms : [];
          floorRooms.forEach((room) => {
            const roomId = room.roomId || room.id;
            if (!roomId) return;

            const rawStatus = String(room.status || "").toUpperCase();
            const normalizedStatus: RoomListStatus =
              rawStatus === "BROKEN"
                ? "BROKEN"
                : rawStatus === "UNAVAILABLE"
                  ? "UNAVAILABLE"
                  : "AVAILABLE";

            flattened.push({
              id: roomId,
              roomName: room.locationCode || room.roomName || "",
              building: building.buildingName || "",
              floorInfo: floor.floorName || "",
              status: normalizedStatus,
              buildingId: building.buildingId,
              floorId: floor.floorId,
            });
          });
        });
      });

      setRooms(flattened);
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to load room data"));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const columns: ColumnsType<RoomListItem> = [
    {
      title: "ROOM NAME",
      dataIndex: "roomName",
      key: "roomName",
      render: (name: string, record: RoomListItem) => (
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
      width: "35%",
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "20%",
      render: (status: RoomListStatus) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(status)}`}
        >
          {status}
        </span>
      ),
    },
    {
      title: "ACTION",
      key: "action",
      width: "15%",
      render: (_: unknown, record: RoomListItem) => {
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

  // Search state for table
  const [tableSearch, setTableSearch] = useState("");
  const buildingOptions = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach((room) => {
      if (!map.has(room.buildingId)) {
        map.set(room.buildingId, room.building);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rooms]);

  const floorOptions = useMemo(() => {
    if (selectedBuildingId === "all")
      return [] as Array<{ id: string; name: string }>;
    const map = new Map<string, string>();
    rooms
      .filter((room) => room.buildingId === selectedBuildingId)
      .forEach((room) => {
        if (!map.has(room.floorId)) {
          map.set(room.floorId, room.floorInfo || room.floorId);
        }
      });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rooms, selectedBuildingId]);

  const locationFilteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (
        selectedBuildingId !== "all" &&
        room.buildingId !== selectedBuildingId
      ) {
        return false;
      }
      if (selectedFloorId !== "all" && room.floorId !== selectedFloorId) {
        return false;
      }
      return true;
    });
  }, [rooms, selectedBuildingId, selectedFloorId]);

  const roomsWithTimeStatus = useMemo(() => {
    if (!timeFilterActive) return locationFilteredRooms;

    return locationFilteredRooms.map((room) => {
      const override = timeStatusOverrides[room.id];
      return override ? { ...room, status: override } : room;
    });
  }, [locationFilteredRooms, timeFilterActive, timeStatusOverrides]);

  const statusFilteredRooms = useMemo(() => {
    if (filter === "available") {
      return roomsWithTimeStatus.filter((r) => r.status === "AVAILABLE");
    }
    if (filter === "unavailable") {
      return roomsWithTimeStatus.filter((r) => r.status === "UNAVAILABLE");
    }
    if (filter === "broken") {
      return roomsWithTimeStatus.filter((r) => r.status === "BROKEN");
    }
    return roomsWithTimeStatus;
  }, [roomsWithTimeStatus, filter]);

  const filteredRooms = statusFilteredRooms.filter(
    (r) =>
      r.roomName.toLowerCase().includes(tableSearch.trim().toLowerCase()) ||
      (r.building &&
        r.building.toLowerCase().includes(tableSearch.trim().toLowerCase())),
  );

  const pagedRooms = filteredRooms.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const totalFiltered = filteredRooms.length;
  const start = totalFiltered === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalFiltered);

  const isBackendDateTime = (value: string) => {
    if (!LOCAL_DATE_TIME_PATTERN.test(value)) return false;
    return !Number.isNaN(new Date(value).getTime());
  };

  const handleApplyTimeFilter = async () => {
    setError(null);
    setPage(0);

    const startTime = buildDateTime(startDate, startHour, startMinute);
    const endTime = buildDateTime(endDate, endHour, endMinute);

    if (!startTime && !endTime) {
      setTimeFilterActive(false);
      setTimeStatusOverrides({});
      return;
    }

    if (!startTime || !endTime) {
      setError("Please select both start time and end time.");
      return;
    }

    if (!isBackendDateTime(startTime) || !isBackendDateTime(endTime)) {
      setError("Invalid date/time format. Expected yyyy-MM-ddTHH:mm:ss.");
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      setError("End time must be later than start time.");
      return;
    }

    setLoading(true);
    try {
      const scopedRooms = locationFilteredRooms;

      const floorPairs = Array.from(
        new Map(
          scopedRooms.map((room) => [
            `${room.buildingId}|${room.floorId}`,
            { buildingId: room.buildingId, floorId: room.floorId },
          ]),
        ).values(),
      );

      const floorResults = await Promise.all(
        floorPairs.map(async (pair) => {
          const availableRooms = await roomService.searchAvailableRooms({
            buildingId: pair.buildingId,
            floorId: pair.floorId,
            startTime: normalizeLocalDateTime(startTime),
            endTime: normalizeLocalDateTime(endTime),
          });

          return {
            key: `${pair.buildingId}|${pair.floorId}`,
            availableSet: new Set(
              availableRooms.map((room) => room.roomId).filter(Boolean),
            ),
          };
        }),
      );

      const floorAvailability = new Map(
        floorResults.map((item) => [item.key, item.availableSet]),
      );

      const overrides: Record<string, RoomListStatus> = {};
      scopedRooms.forEach((room) => {
        if (room.status === "BROKEN") {
          overrides[room.id] = "BROKEN";
          return;
        }

        const key = `${room.buildingId}|${room.floorId}`;
        const availableSet = floorAvailability.get(key);

        overrides[room.id] = availableSet?.has(room.id)
          ? "AVAILABLE"
          : "UNAVAILABLE";
      });

      setTimeStatusOverrides(overrides);
      setTimeFilterActive(true);
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to apply time filter"));
      setTimeFilterActive(false);
      setTimeStatusOverrides({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-10">
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
          className="w-full sm:w-auto sm:self-start px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium shadow hover:bg-orange-600"
        >
          Show Room Map
        </button>
      </div>

      {/* Filter + Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
              Status
            </div>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as FilterType);
                setPage(0);
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="broken">Maintenance</option>
            </select>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
              Building
            </div>
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                setSelectedFloorId("all");
                setPage(0);
                setTimeFilterActive(false);
                setTimeStatusOverrides({});
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="all">All buildings</option>
              {buildingOptions.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
              Floor
            </div>
            <select
              value={selectedFloorId}
              onChange={(e) => {
                setSelectedFloorId(e.target.value);
                setPage(0);
                setTimeFilterActive(false);
                setTimeStatusOverrides({});
              }}
              disabled={selectedBuildingId === "all"}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="all">All floors</option>
              {floorOptions.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto_1fr] gap-3 items-end">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-2">
              Start time
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <div className="min-w-0">
                <DatePickerField
                  value={startDate}
                  onChange={(nextDate) => {
                    setStartDate(nextDate);
                    setPage(0);
                  }}
                />
              </div>
              <select
                value={startHour}
                onChange={(e) => {
                  setStartHour(e.target.value);
                  setPage(0);
                }}
                className="w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
              <select
                value={startMinute}
                onChange={(e) => {
                  setStartMinute(e.target.value);
                  setPage(0);
                }}
                className="w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {MINUTE_OPTIONS.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}m
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-2">
              End time
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <div className="min-w-0">
                <DatePickerField
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={(nextDate) => {
                    setEndDate(nextDate);
                    setPage(0);
                  }}
                />
              </div>
              <select
                value={endHour}
                onChange={(e) => {
                  setEndHour(e.target.value);
                  setPage(0);
                }}
                className="w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </select>
              <select
                value={endMinute}
                onChange={(e) => {
                  setEndMinute(e.target.value);
                  setPage(0);
                }}
                className="w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {MINUTE_OPTIONS.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}m
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleApplyTimeFilter}
            className="h-[42px] w-full xl:w-auto px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 inline-flex items-center justify-center gap-1.5"
          >
            <ClockIcon className="h-4 w-4" />
            Apply time
          </button>

          <button
            type="button"
            onClick={() => {
              const nextRange = getCurrentTimeRange();
              setStartDate(nextRange.startDate);
              setEndDate(nextRange.endDate);
              setStartHour(nextRange.startHour);
              setStartMinute(nextRange.startMinute);
              setEndHour(nextRange.endHour);
              setEndMinute(nextRange.endMinute);
              setPage(0);
              setTimeFilterActive(false);
              setTimeStatusOverrides({});
            }}
            className="h-[42px] w-full xl:w-auto px-4 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-100"
          >
            Clear time
          </button>

          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
              Search
            </div>
            <input
              type="text"
              placeholder="Search by room or building..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setPage(0);
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
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

      <div className="md:hidden space-y-3 mb-4">
        {pagedRooms.map((room) => {
          const isAvailable = room.status === "AVAILABLE";
          return (
            <article
              key={room.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-gray-800">
                    {room.roomName}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {room.floorInfo || "-"}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusBadgeClass(room.status)}`}
                >
                  {room.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600">
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2">
                  <div className="text-[11px] text-gray-500">Building</div>
                  <div className="font-medium text-gray-700">
                    {room.building}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={`mt-3 w-full px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  isAvailable
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => {
                  navigate(ROUTES.BOOK_ROOM.replace(":roomId", room.id), {
                    state: { room },
                  });
                }}
              >
                {isAvailable ? "Book" : "View"}
              </button>
            </article>
          );
        })}

        {!loading && pagedRooms.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-500">
            No rooms match your current filters.
          </div>
        )}
      </div>

      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table<RoomListItem>
            columns={columns}
            dataSource={pagedRooms}
            rowKey="id"
            loading={loading}
            pagination={false}
            scroll={{ x: 800 }}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mt-6">
        <Text className="text-gray-500 text-sm text-center sm:text-left">
          Showing {loading ? 0 : start}–{loading ? 0 : end} of {totalFiltered}
        </Text>

        <div className="flex gap-2 self-center sm:self-auto">
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
