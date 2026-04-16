import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Typography, Table, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { ClockIcon } from "@heroicons/react/24/outline";
import { roomService } from "../../services/roomService";
import { ROUTES } from "../../constants";
import { extractApiMessage } from "../../utils/errorHandlers";
import DatePickerField from "../../components/common/DatePickerField";
import AnimatedDropdown, {
  type AnimatedDropdownOption,
} from "../../components/common/AnimatedDropdown";
import { useRealtimeClock } from "../../hooks";
import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  LOCAL_DATE_TIME_PATTERN,
  buildDateTime,
  clampToRange,
  getCurrentTimeRange,
  normalizeLocalDateTime,
  toDateInputValue,
  toTotalMinutes,
} from "../../utils";

const { Title, Text } = Typography;

type RoomListStatus = "AVAILABLE" | "UNAVAILABLE" | "BROKEN" | "LEARNING";
type FilterType = "all" | "available" | "unavailable" | "broken" | "learning";

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

const roomStatusFilterOptions: Array<AnimatedDropdownOption<FilterType>> = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "broken", label: "Maintenance" },
  { value: "learning", label: "Classroom" },
];

const getStatusBadgeClass = (status: RoomListStatus) => {
  if (status === "AVAILABLE") return "bg-green-100 text-green-700";
  if (status === "BROKEN") return "bg-slate-200 text-slate-700";
  if (status === "LEARNING") return "bg-purple-100 text-purple-700";
  return "bg-red-100 text-red-600";
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const currentTimeRange = useMemo(() => getCurrentTimeRange(), []);
  const clockTick = useRealtimeClock();
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
  const nowParts = useMemo(() => {
    const now = new Date(clockTick);
    return {
      date: toDateInputValue(now),
      hour: String(now.getHours()).padStart(2, "0"),
      minute: String(now.getMinutes()).padStart(2, "0"),
    };
  }, [clockTick]);

  const minStartMinutes = useMemo(
    () => toTotalMinutes(nowParts.hour, nowParts.minute),
    [nowParts.hour, nowParts.minute],
  );

  const minEndDate = useMemo(
    () => (startDate > nowParts.date ? startDate : nowParts.date),
    [nowParts.date, startDate],
  );

  const minEndMinutes = useMemo(() => {
    const nowMinutes = toTotalMinutes(nowParts.hour, nowParts.minute);
    const startMinutes = toTotalMinutes(startHour, startMinute);

    if (startDate === nowParts.date && minEndDate === nowParts.date) {
      return Math.max(nowMinutes, startMinutes);
    }

    if (minEndDate === nowParts.date) {
      return nowMinutes;
    }

    if (minEndDate === startDate) {
      return startMinutes;
    }

    return 0;
  }, [
    minEndDate,
    nowParts.date,
    nowParts.hour,
    nowParts.minute,
    startDate,
    startHour,
    startMinute,
  ]);

  const minEndHourValue = useMemo(
    () => String(Math.floor(minEndMinutes / 60)).padStart(2, "0"),
    [minEndMinutes],
  );

  const startHourDropdownOptions = useMemo<
    Array<AnimatedDropdownOption<string>>
  >(
    () =>
      HOUR_OPTIONS.map((hour) => ({
        value: hour.value,
        label: `${hour.value}h`,
        disabled:
          startDate === nowParts.date &&
          Number(hour.value) * 60 < minStartMinutes,
      })),
    [minStartMinutes, nowParts.date, startDate],
  );

  const startMinuteDropdownOptions = useMemo<
    Array<AnimatedDropdownOption<string>>
  >(
    () =>
      MINUTE_OPTIONS.map((minute) => ({
        value: minute,
        label: `${minute}m`,
        disabled:
          startDate === nowParts.date &&
          startHour === nowParts.hour &&
          Number(minute) < Number(nowParts.minute),
      })),
    [nowParts.date, nowParts.hour, nowParts.minute, startDate, startHour],
  );

  const endHourDropdownOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () =>
      HOUR_OPTIONS.map((hour) => ({
        value: hour.value,
        label: `${hour.value}h`,
        disabled:
          endDate === minEndDate && Number(hour.value) * 60 < minEndMinutes,
      })),
    [endDate, minEndDate, minEndMinutes],
  );

  const endMinuteDropdownOptions = useMemo<
    Array<AnimatedDropdownOption<string>>
  >(
    () =>
      MINUTE_OPTIONS.map((minute) => ({
        value: minute,
        label: `${minute}m`,
        disabled:
          endDate === minEndDate &&
          endHour === minEndHourValue &&
          Number(minute) < minEndMinutes % 60,
      })),
    [endDate, endHour, minEndDate, minEndHourValue, minEndMinutes],
  );

  useEffect(() => {
    if (startDate < nowParts.date) {
      setStartDate(nowParts.date);
      setStartHour(nowParts.hour);
      setStartMinute(nowParts.minute);
      return;
    }

    if (startDate === nowParts.date) {
      const startMinutes = toTotalMinutes(startHour, startMinute);
      if (startMinutes < minStartMinutes) {
        const safeMinutes = clampToRange(minStartMinutes, 0, 23 * 60 + 59);
        const nextHour = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
        const nextMinute = String(safeMinutes % 60).padStart(2, "0");
        setStartHour(nextHour);
        setStartMinute(nextMinute);
      }
    }
  }, [
    minStartMinutes,
    nowParts.date,
    nowParts.hour,
    nowParts.minute,
    startDate,
    startHour,
    startMinute,
  ]);

  useEffect(() => {
    if (endDate < minEndDate) {
      setEndDate(minEndDate);
      const safeMinutes = clampToRange(minEndMinutes, 0, 23 * 60 + 59);
      setEndHour(String(Math.floor(safeMinutes / 60)).padStart(2, "0"));
      setEndMinute(String(safeMinutes % 60).padStart(2, "0"));
      return;
    }

    if (endDate === minEndDate) {
      const endMinutes = toTotalMinutes(endHour, endMinute);
      if (endMinutes < minEndMinutes) {
        const safeMinutes = clampToRange(minEndMinutes, 0, 23 * 60 + 59);
        setEndHour(String(Math.floor(safeMinutes / 60)).padStart(2, "0"));
        setEndMinute(String(safeMinutes % 60).padStart(2, "0"));
      }
    }
  }, [endDate, endHour, endMinute, minEndDate, minEndMinutes]);

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
                  : rawStatus === "LEARNING"
                    ? "LEARNING"
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
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: "20%",
      render: (status: RoomListStatus) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(status)}`}
        >
          {status === "LEARNING" ? "LEARNING" : status}
        </span>
      ),
    },
    {
      title: "ACTION",
      key: "action",
      width: "15%",
      render: (_: unknown, record: RoomListItem) => {
        return (
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
            onClick={() => {
              navigate(ROUTES.ROOM_DETAIL.replace(":roomId", record.id), {
                state: { room: record },
              });
            }}
          >
            View
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

  const buildingFilterOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () => [
      { value: "all", label: "All buildings" },
      ...buildingOptions.map((building) => ({
        value: building.id,
        label: building.name,
      })),
    ],
    [buildingOptions],
  );

  const floorFilterOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () => [
      { value: "all", label: "All floors" },
      ...floorOptions.map((floor) => ({
        value: floor.id,
        label: floor.name,
      })),
    ],
    [floorOptions],
  );

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
    if (filter === "learning") {
      return roomsWithTimeStatus.filter((r) => r.status === "LEARNING");
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
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index);
    }

    const startPage = Math.max(0, Math.min(page - 2, totalPages - 5));
    return Array.from({ length: 5 }, (_, index) => startPage + index);
  }, [page, totalPages]);

  const canGoPrev = page > 0;
  const canGoNext = page < totalPages - 1;

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
            statusMap: new Map(
              availableRooms.map((room) => [room.roomId, room.status]),
            ),
          };
        }),
      );

      const floorAvailability = new Map(
        floorResults.map((item) => [item.key, item.statusMap]),
      );

      const overrides: Record<string, RoomListStatus> = {};
      scopedRooms.forEach((room) => {
        if (room.status === "BROKEN") {
          overrides[room.id] = "BROKEN";
          return;
        }

        const key = `${room.buildingId}|${room.floorId}`;
        const statusMap = floorAvailability.get(key);

        if (statusMap?.has(room.id)) {
          overrides[room.id] = statusMap.get(room.id) as RoomListStatus;
        } else {
          overrides[room.id] = "UNAVAILABLE";
        }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[max-content_max-content_max-content_minmax(16rem,1fr)] gap-3 items-end">
          <div className="w-full xl:min-w-[150px] xl:w-auto">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
              Status
            </div>
            <AnimatedDropdown<FilterType>
              value={filter}
              options={roomStatusFilterOptions}
              onChange={(nextValue) => {
                setFilter(nextValue);
                setPage(0);
              }}
              buttonClassName="h-[42px] border-gray-200 bg-white"
              ariaLabel="Filter rooms by status"
            />
          </div>

          <div className="w-full xl:min-w-[180px] xl:w-auto">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
              Building
            </div>
            <AnimatedDropdown<string>
              value={selectedBuildingId}
              options={buildingFilterOptions}
              onChange={(nextValue) => {
                setSelectedBuildingId(nextValue);
                setSelectedFloorId("all");
                setPage(0);
                setTimeFilterActive(false);
                setTimeStatusOverrides({});
              }}
              buttonClassName="h-[42px] border-gray-200 bg-white"
              ariaLabel="Filter rooms by building"
            />
          </div>

          <div className="w-full xl:min-w-[160px] xl:w-auto">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
              Floor
            </div>
            <AnimatedDropdown<string>
              value={selectedFloorId}
              options={floorFilterOptions}
              onChange={(nextValue) => {
                setSelectedFloorId(nextValue);
                setPage(0);
                setTimeFilterActive(false);
                setTimeStatusOverrides({});
              }}
              disabled={selectedBuildingId === "all"}
              buttonClassName="h-[42px] border-gray-200 bg-white"
              ariaLabel="Filter rooms by floor"
            />
          </div>

          <div className="w-full xl:min-w-[280px]">
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-3 items-end">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-2">
              Start time
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <div className="min-w-0">
                <DatePickerField
                  value={startDate}
                  minDate={nowParts.date}
                  onChange={(nextDate) => {
                    setStartDate(nextDate);
                    setPage(0);
                  }}
                />
              </div>
              <AnimatedDropdown<string>
                value={startHour}
                options={startHourDropdownOptions}
                onChange={(nextValue) => {
                  setStartHour(nextValue);
                  setPage(0);
                }}
                buttonClassName="h-[40px] border-gray-200 bg-white px-3 text-sm font-semibold tabular-nums"
                menuClassName="max-h-56 overflow-y-auto"
                optionClassName="text-sm tabular-nums"
                ariaLabel="Select start hour"
              />
              <AnimatedDropdown<string>
                value={startMinute}
                options={startMinuteDropdownOptions}
                onChange={(nextValue) => {
                  setStartMinute(nextValue);
                  setPage(0);
                }}
                buttonClassName="h-[40px] border-gray-200 bg-white px-3 text-sm font-semibold tabular-nums"
                menuClassName="max-h-56 overflow-y-auto"
                optionClassName="text-sm tabular-nums"
                ariaLabel="Select start minute"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-2">
              End time
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <div className="min-w-0">
                <DatePickerField
                  value={endDate}
                  minDate={minEndDate}
                  onChange={(nextDate) => {
                    setEndDate(nextDate);
                    setPage(0);
                  }}
                />
              </div>
              <AnimatedDropdown<string>
                value={endHour}
                options={endHourDropdownOptions}
                onChange={(nextValue) => {
                  setEndHour(nextValue);
                  setPage(0);
                }}
                buttonClassName="h-[40px] border-gray-200 bg-white px-3 text-sm font-semibold tabular-nums"
                menuClassName="max-h-56 overflow-y-auto"
                optionClassName="text-sm tabular-nums"
                ariaLabel="Select end hour"
              />
              <AnimatedDropdown<string>
                value={endMinute}
                options={endMinuteDropdownOptions}
                onChange={(nextValue) => {
                  setEndMinute(nextValue);
                  setPage(0);
                }}
                buttonClassName="h-[40px] border-gray-200 bg-white px-3 text-sm font-semibold tabular-nums"
                menuClassName="max-h-56 overflow-y-auto"
                optionClassName="text-sm tabular-nums"
                ariaLabel="Select end minute"
              />
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
                  const targetRoute = isAvailable
                    ? ROUTES.BOOK_ROOM
                    : ROUTES.ROOM_DETAIL;
                  navigate(targetRoute.replace(":roomId", room.id), {
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

      <div className="mt-6 rounded-2xl border border-orange-100 bg-white/90 px-3 py-3 shadow-sm sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text className="text-center text-sm text-slate-600 sm:text-left">
            Showing{" "}
            <span className="font-semibold text-slate-800">
              {loading ? 0 : start}
            </span>
            -
            <span className="font-semibold text-slate-800">
              {loading ? 0 : end}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800">
              {totalFiltered}
            </span>
          </Text>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>

            {visiblePages[0] > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setPage(0)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                >
                  1
                </button>
                {visiblePages[0] > 1 && (
                  <span className="px-1 text-sm text-slate-400">...</span>
                )}
              </>
            )}

            {visiblePages.map((pageNumber) => {
              const active = pageNumber === page;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                    active
                      ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  }`}
                >
                  {pageNumber + 1}
                </button>
              );
            })}

            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
              <>
                {visiblePages[visiblePages.length - 1] < totalPages - 2 && (
                  <span className="px-1 text-sm text-slate-400">...</span>
                )}
                <button
                  type="button"
                  onClick={() => setPage(totalPages - 1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
