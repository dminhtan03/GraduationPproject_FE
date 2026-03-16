import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Pagination, Rate } from "antd";
import { TagIcon, ClockIcon } from "@heroicons/react/24/outline";
import {
  roomService,
  type RoomsMapBuilding,
  type RoomStatusItem,
} from "../../services/roomService";
import {
  feedbackService,
  type RoomFeedbackItem,
} from "../../services/feedbackService";
import { ROUTES } from "../../constants";
import {
  type MapRoom,
  type MapRoomStatus,
  type FloorWithRooms,
  type SelectedRoom,
  splitRoomsForMap,
  getStatusStyles,
  sortFloorsByLevel,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  LOCAL_DATE_TIME_PATTERN,
  buildDateTime,
  clampToRange,
  getCurrentTimeRange,
  getTimeOptionStyle,
  normalizeLocalDateTime,
  toDateInputValue,
  toTotalMinutes,
} from "../../utils";
import DatePickerField from "../../components/common/DatePickerField";
import { extractApiMessage } from "../../utils/errorHandlers";
import { useRealtimeClock, useRoomStatusWebSocket } from "../../hooks";

type RoomDetail = {
  roomId?: string;
  locationCode?: string;
  status?: MapRoomStatus;
  capacity?: number | null;
  amenities?: { id: string; name: string }[] | null;
  images?: { id: string; imageUrl: string }[] | null;
  score?: number | null;
  currentUserId?: string | null;
  currentUserName?: string | null;
  checkInTime?: string | null;
};

const formatFeedbackName = (name?: string | null) => {
  const trimmed = String(name || "").trim();
  return trimmed || "Anonymous user";
};

type BuildingLayoutVariant =
  | "gamma"
  | "alphaStyle"
  | "betaStyle"
  | "deltaStyle"
  | "epsilonStyle";

type RawMapRoom = {
  roomId?: string;
  locationCode?: string;
  status?: string;
  score?: number | null;
};

type RawMapFloor = {
  floorId: string;
  floorName: string;
  rooms?: RawMapRoom[];
};

type RawMapBuilding = {
  buildingId: string;
  buildingName: string;
  floors?: RawMapFloor[];
};

const formatCheckInDateTime = (value?: string | null) => {
  if (!value) return "No check-in yet";

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const trimmedFraction = normalized.replace(/\.(\d{3})\d+/, ".$1");
  const parsed = new Date(trimmedFraction);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  const second = String(parsed.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
};

const ROOM_LAYOUT_STORAGE_KEY = "room-map-layout-order";
const FEEDBACK_PAGE_SIZE = 5;

const chunkRooms = <T,>(rooms: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < rooms.length; index += size) {
    result.push(rooms.slice(index, index + size));
  }
  return result;
};

const resolveLayoutVariant = (
  currentBuilding: RoomsMapBuilding | null,
  allBuildings: RoomsMapBuilding[],
): BuildingLayoutVariant => {
  if (!currentBuilding) return "gamma";

  const name = (currentBuilding.buildingName || "").toLowerCase();
  if (name.includes("gamma")) return "gamma";

  const nonGammaBuildings = allBuildings.filter(
    (building) =>
      !(building.buildingName || "").toLowerCase().includes("gamma"),
  );

  const index = nonGammaBuildings.findIndex(
    (building) => building.buildingId === currentBuilding.buildingId,
  );

  const variants: BuildingLayoutVariant[] = [
    "alphaStyle",
    "betaStyle",
    "deltaStyle",
    "epsilonStyle",
  ];

  if (index < 0) return "alphaStyle";
  return variants[index % variants.length];
};

const RoomMapPage: React.FC = () => {
  const navigate = useNavigate();
  const currentTimeRange = useMemo(() => getCurrentTimeRange(), []);
  const clockTick = useRealtimeClock();

  const [buildings, setBuildings] = useState<RoomsMapBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [roomDetail, setRoomDetail] = useState<RoomDetail | null>(null);
  const [roomDetailLoading, setRoomDetailLoading] = useState(false);
  const [roomDetailError, setRoomDetailError] = useState<string | null>(null);
  const [roomFeedbacks, setRoomFeedbacks] = useState<RoomFeedbackItem[]>([]);
  const [roomFeedbackTotal, setRoomFeedbackTotal] = useState(0);
  const [roomFeedbackPage, setRoomFeedbackPage] = useState(1);
  const [roomFeedbackLoading, setRoomFeedbackLoading] = useState(false);
  const [roomFeedbackError, setRoomFeedbackError] = useState<string | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<"ALL" | MapRoomStatus>(
    "ALL",
  );
  const [startDate, setStartDate] = useState(currentTimeRange.startDate);
  const [startHour, setStartHour] = useState(currentTimeRange.startHour);
  const [startMinute, setStartMinute] = useState(currentTimeRange.startMinute);
  const [endDate, setEndDate] = useState(currentTimeRange.endDate);
  const [endHour, setEndHour] = useState(currentTimeRange.endHour);
  const [endMinute, setEndMinute] = useState(currentTimeRange.endMinute);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [overrideStatuses, setOverrideStatuses] = useState<
    Record<string, MapRoomStatus>
  >({});
  const [roomOrderByFloor, setRoomOrderByFloor] = useState<
    Record<string, string[]>
  >({});
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);

  useRoomStatusWebSocket({
    floorId: selectedFloorId,
    onStatusChange: (roomId, nextStatus) => {
      setBuildings((prev) =>
        prev.map((building) => ({
          ...building,
          floors: (building.floors || []).map((floor) => ({
            ...floor,
            rooms: (floor.rooms || []).map((room) =>
              String(room.roomId || "") === roomId
                ? {
                    ...room,
                    status: nextStatus,
                  }
                : room,
            ),
          })),
        })),
      );

      setOverrideStatuses((prev) => ({
        ...prev,
        [roomId]: nextStatus,
      }));

      setSelectedRoom((prev) =>
        prev && prev.roomId === roomId
          ? {
              ...prev,
              status: nextStatus,
            }
          : prev,
      );

      setRoomDetail((prev) =>
        prev && prev.roomId === roomId
          ? {
              ...prev,
              status: nextStatus,
            }
          : prev,
      );
    },
  });

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
        setStartHour(String(Math.floor(safeMinutes / 60)).padStart(2, "0"));
        setStartMinute(String(safeMinutes % 60).padStart(2, "0"));
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROOM_LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string[]>;
      if (parsed && typeof parsed === "object") {
        setRoomOrderByFloor(parsed);
      }
    } catch {
      // Ignore invalid localStorage data
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        ROOM_LAYOUT_STORAGE_KEY,
        JSON.stringify(roomOrderByFloor),
      );
    } catch {
      // Ignore storage errors (quota/privacy mode)
    }
  }, [roomOrderByFloor]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await roomService.getRoomsMap();
        const list: RawMapBuilding[] = Array.isArray(data.buildingResponse)
          ? (data.buildingResponse as RawMapBuilding[])
          : [];

        const normalizedList = list.map((building) => ({
          ...building,
          floors: sortFloorsByLevel(building.floors),
        }));

        setBuildings(normalizedList as RoomsMapBuilding[]);

        if (normalizedList.length > 0) {
          const firstBuilding = normalizedList[0];
          setSelectedBuildingId(firstBuilding.buildingId);
          if (firstBuilding.floors && firstBuilding.floors.length > 0) {
            setSelectedFloorId(firstBuilding.floors[0].floorId);
          }
        }
      } catch (e: unknown) {
        const message =
          e && typeof e === "object" && "message" in e
            ? String((e as { message?: string }).message || "")
            : "Unable to load room map";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const currentBuilding = useMemo(
    () => buildings.find((b) => b.buildingId === selectedBuildingId) || null,
    [buildings, selectedBuildingId],
  );

  const currentFloor: FloorWithRooms | null = useMemo(() => {
    if (!currentBuilding || !currentBuilding.floors) return null;
    const floor =
      currentBuilding.floors.find((f) => f.floorId === selectedFloorId) ||
      currentBuilding.floors[0];
    if (!floor) return null;

    const rooms: MapRoom[] = Array.isArray(floor.rooms)
      ? floor.rooms.map((r) => {
          const baseStatus = r.status as MapRoomStatus;
          const override = overrideStatuses[String(r.roomId || "")];
          return {
            roomId: String(r.roomId || ""),
            locationCode: String(r.locationCode || ""),
            status: override ?? baseStatus,
            score: r.score,
          };
        })
      : [];

    return {
      floorId: floor.floorId,
      floorName: floor.floorName,
      rooms,
    };
  }, [currentBuilding, selectedFloorId, overrideStatuses]);

  const isFloorFull = (floor: { rooms: { status?: string }[] }) => {
    if (!floor.rooms || floor.rooms.length === 0) return false;
    return floor.rooms.every((r) => r.status !== "AVAILABLE");
  };

  const currentFloorKey = useMemo(() => {
    if (!currentBuilding || !currentFloor) return "";
    return `${currentBuilding.buildingId}|${currentFloor.floorId}`;
  }, [currentBuilding, currentFloor]);

  const orderedRooms = useMemo(() => {
    const rooms = currentFloor?.rooms || [];
    if (!currentFloorKey || rooms.length === 0) return rooms;

    const savedOrder = roomOrderByFloor[currentFloorKey];
    if (!savedOrder || savedOrder.length === 0) return rooms;

    const roomMap = new Map(rooms.map((room) => [room.roomId, room]));
    const ordered = savedOrder
      .map((roomId) => roomMap.get(roomId))
      .filter((room): room is MapRoom => Boolean(room));

    const missing = rooms.filter((room) => !savedOrder.includes(room.roomId));
    return [...ordered, ...missing];
  }, [currentFloor, currentFloorKey, roomOrderByFloor]);

  useEffect(() => {
    if (!currentFloorKey || orderedRooms.length === 0) return;

    setRoomOrderByFloor((prev) => {
      if (prev[currentFloorKey]?.length) return prev;
      return {
        ...prev,
        [currentFloorKey]: orderedRooms.map((room) => room.roomId),
      };
    });
  }, [currentFloorKey, orderedRooms]);

  const filteredRooms = useMemo(() => {
    if (!currentFloor) return [] as MapRoom[];
    if (statusFilter === "ALL") return orderedRooms;
    return orderedRooms.filter((room) => room.status === statusFilter);
  }, [currentFloor, orderedRooms, statusFilter]);

  const { top, left, right, bottom } = useMemo(
    () => splitRoomsForMap(filteredRooms),
    [filteredRooms],
  );

  const layoutVariant = useMemo(
    () => resolveLayoutVariant(currentBuilding, buildings),
    [currentBuilding, buildings],
  );

  const renderRoomTile = (
    room: MapRoom,
    className = "h-16",
    textClassName = "text-[11px] sm:text-xs",
  ) => (
    <button
      key={room.roomId}
      type="button"
      onClick={() => handleRoomClick(room)}
      draggable
      onDragStart={() => setDraggedRoomId(room.roomId)}
      onDragEnd={() => {
        setDraggedRoomId(null);
        setDragOverRoomId(null);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => setDragOverRoomId(room.roomId)}
      onDragLeave={() => {
        if (dragOverRoomId === room.roomId) {
          setDragOverRoomId(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (!draggedRoomId || draggedRoomId === room.roomId || !currentFloorKey)
          return;

        const currentOrder =
          roomOrderByFloor[currentFloorKey] ||
          orderedRooms.map((item) => item.roomId);
        const dragIndex = currentOrder.indexOf(draggedRoomId);
        const targetIndex = currentOrder.indexOf(room.roomId);
        if (dragIndex < 0 || targetIndex < 0) return;

        const nextOrder = [...currentOrder];
        const [draggedId] = nextOrder.splice(dragIndex, 1);
        nextOrder.splice(targetIndex, 0, draggedId);

        setRoomOrderByFloor((prev) => ({
          ...prev,
          [currentFloorKey]: nextOrder,
        }));
        setDraggedRoomId(null);
        setDragOverRoomId(null);
      }}
      className={`${className} rounded-xl border ${textClassName} font-medium flex flex-col items-center justify-center text-center cursor-pointer transition hover:shadow-sm hover:-translate-y-0.5 ${getStatusStyles(room.status)} ${dragOverRoomId === room.roomId ? "ring-2 ring-orange-400 ring-offset-2" : ""}`}
    >
      <span className="mb-0.5">{room.locationCode}</span>
      {draggedRoomId === room.roomId && (
        <span className="text-[10px] opacity-70">Moving...</span>
      )}
    </button>
  );

  const handleApplyFilters = async () => {
    setFilterError(null);
    setOverrideStatuses({});

    const startTime = buildDateTime(startDate, startHour, startMinute);
    const endTime = buildDateTime(endDate, endHour, endMinute);

    if (!currentBuilding || !currentFloor) return;

    if (!startTime || !endTime) {
      setFilterError("Please select both start and end time.");
      return;
    }

    const isBackendDateTime = (value: string) => {
      if (!LOCAL_DATE_TIME_PATTERN.test(value)) return false;
      return !Number.isNaN(new Date(value).getTime());
    };

    if (!isBackendDateTime(startTime) || !isBackendDateTime(endTime)) {
      setFilterError("Invalid date/time format. Expected yyyy-MM-ddTHH:mm:ss.");
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      setFilterError("End time must be later than start time.");
      return;
    }

    setFilterLoading(true);
    try {
      const startDateTime = normalizeLocalDateTime(startTime);
      const endDateTime = normalizeLocalDateTime(endTime);

      // BE /api/v1/rooms/search trả về danh sách PHÒNG TRỐNG
      const availableRooms: RoomStatusItem[] =
        await roomService.searchAvailableRooms({
          buildingId: currentBuilding.buildingId,
          floorId: currentFloor.floorId,
          startTime: startDateTime,
          endTime: endDateTime,
        });

      const availableSet = new Set(
        availableRooms.map((item) => item.roomId).filter(Boolean),
      );

      const overrides: Record<string, MapRoomStatus> = {};

      (currentFloor.rooms || []).forEach((room) => {
        if (room.status === "BROKEN") {
          overrides[room.roomId] = "BROKEN";
          return;
        }

        if (availableSet.has(room.roomId)) {
          overrides[room.roomId] = "AVAILABLE";
        } else {
          overrides[room.roomId] = "UNAVAILABLE";
        }
      });

      setOverrideStatuses(overrides);
    } catch (e: unknown) {
      setFilterError(extractApiMessage(e, "Unable to apply time filter"));
    } finally {
      setFilterLoading(false);
    }
  };

  const handleRoomClick = async (room: MapRoom) => {
    if (!currentBuilding || !currentFloor) return;
    setSelectedRoom({
      ...room,
      buildingName: currentBuilding.buildingName,
      floorName: currentFloor.floorName,
    });

    setRoomDetail(null);
    setRoomDetailError(null);
    setRoomDetailLoading(true);
    setRoomFeedbacks([]);
    setRoomFeedbackTotal(0);
    setRoomFeedbackPage(1);
    setRoomFeedbackError(null);

    try {
      const detail = await roomService.getRoomDetail(room.roomId);
      setRoomDetail(detail as RoomDetail);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message || "")
          : "Unable to load room details";
      setRoomDetailError(message);
    } finally {
      setRoomDetailLoading(false);
    }
  };

  useEffect(() => {
    const roomId = selectedRoom?.roomId;

    if (!roomId) {
      setRoomFeedbacks([]);
      setRoomFeedbackTotal(0);
      setRoomFeedbackError(null);
      setRoomFeedbackLoading(false);
      return;
    }

    const loadRoomFeedbacks = async () => {
      setRoomFeedbackLoading(true);
      setRoomFeedbackError(null);

      try {
        const feedbackResult = await feedbackService.getRoomFeedbacks(
          roomId,
          roomFeedbackPage - 1,
          FEEDBACK_PAGE_SIZE,
        );

        setRoomFeedbacks(feedbackResult.items);
        setRoomFeedbackTotal(feedbackResult.total);
      } catch (e: unknown) {
        setRoomFeedbackError(extractApiMessage(e, "Unable to load feedback"));
        setRoomFeedbacks([]);
        setRoomFeedbackTotal(0);
      } finally {
        setRoomFeedbackLoading(false);
      }
    };

    loadRoomFeedbacks();
  }, [selectedRoom?.roomId, roomFeedbackPage]);

  const handleBooking = () => {
    if (!selectedRoom) return;
    // Pass roomId in URL and full room data in state
    navigate(ROUTES.BOOK_ROOM.replace(":roomId", selectedRoom.roomId), {
      state: {
        room: {
          id: selectedRoom.roomId,
          roomName: selectedRoom.locationCode,
          building: selectedRoom.buildingName,
          floorInfo: selectedRoom.floorName,
          status: selectedRoom.status,
        },
      },
    });
  };

  if (loading && buildings.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="h-12 w-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && buildings.length === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <Alert
          message="Unable to load room map"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-1">
            Interactive Campus Map
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate(ROUTES.ROOM_LIST)}
            className="w-full sm:w-auto px-4 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            List view
          </button>
          <button
            type="button"
            disabled={!selectedRoom}
            onClick={handleBooking}
            className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Book a room
          </button>
        </div>
      </div>

      {/* Filters: Status + Time range */}
      <div className="mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4">
        <div className="flex w-full flex-col items-center gap-4 lg:flex-row lg:items-end lg:justify-center lg:gap-6">
          <div className="w-full lg:w-auto lg:-mt-2">
            <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase mb-1">
              Status
            </div>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | MapRoomStatus)
              }
              className="w-full max-w-[240px] lg:w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">In Use</option>
              <option value="BROKEN">Maintenance</option>
            </select>
          </div>

          <div className="w-full lg:w-auto">
            <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase mb-1">
              Time range
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="text-[10px] font-semibold tracking-wide uppercase text-slate-500 mb-1.5">
                  Start
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <DatePickerField
                      value={startDate}
                      minDate={nowParts.date}
                      onChange={setStartDate}
                    />
                  </div>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {HOUR_OPTIONS.map((hour) => {
                      const isDisabled =
                        startDate === nowParts.date &&
                        Number(hour.value) * 60 < minStartMinutes;

                      return (
                        <option
                          key={hour.value}
                          value={hour.value}
                          disabled={isDisabled}
                          style={getTimeOptionStyle(isDisabled)}
                        >
                          {hour.label}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-full min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {MINUTE_OPTIONS.map((minute) => {
                      const isDisabled =
                        startDate === nowParts.date &&
                        startHour === nowParts.hour &&
                        Number(minute) < Number(nowParts.minute);

                      return (
                        <option
                          key={minute}
                          value={minute}
                          disabled={isDisabled}
                          style={getTimeOptionStyle(isDisabled)}
                        >
                          {minute}m
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="text-[10px] font-semibold tracking-wide uppercase text-slate-500 mb-1.5">
                  End
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <DatePickerField
                      value={endDate}
                      minDate={minEndDate}
                      onChange={setEndDate}
                    />
                  </div>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {HOUR_OPTIONS.map((hour) => {
                      const isDisabled =
                        endDate === minEndDate &&
                        Number(hour.value) * 60 < minEndMinutes;

                      return (
                        <option
                          key={hour.value}
                          value={hour.value}
                          disabled={isDisabled}
                          style={getTimeOptionStyle(isDisabled)}
                        >
                          {hour.label}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-full min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {MINUTE_OPTIONS.map((minute) => {
                      const isDisabled =
                        endDate === minEndDate &&
                        endHour ===
                          String(Math.floor(minEndMinutes / 60)).padStart(
                            2,
                            "0",
                          ) &&
                        Number(minute) < minEndMinutes % 60;

                      return (
                        <option
                          key={minute}
                          value={minute}
                          disabled={isDisabled}
                          style={getTimeOptionStyle(isDisabled)}
                        >
                          {minute}m
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center justify-center lg:w-auto lg:-mt-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={filterLoading || !currentBuilding || !currentFloor}
              className="w-full max-w-[240px] sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ClockIcon className="w-4 h-4" />
              <span>Apply filters</span>
            </button>
          </div>
        </div>
      </div>

      {filterError && (
        <div className="mb-4 text-xs text-rose-500">{filterError}</div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Building tabs + legend */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {buildings.map((building) => (
            <button
              key={building.buildingId}
              type="button"
              onClick={() => {
                setSelectedBuildingId(building.buildingId);
                const firstFloor =
                  building.floors && building.floors.length > 0
                    ? building.floors[0]
                    : null;
                setSelectedFloorId(firstFloor ? firstFloor.floorId : null);
                setSelectedRoom(null);
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition
								${
                  building.buildingId === selectedBuildingId
                    ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              {building.buildingName}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-700">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span>In Use</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 rounded-full bg-slate-300" />
            <span>Maintenance</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_2.2fr)_minmax(0,_1.2fr)] gap-6 items-start">
        {/* Map + floor selector */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-2">
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {currentBuilding ? currentBuilding.buildingName : "No building"}
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-semibold text-slate-600">Select floor</span>
              <div className="flex flex-wrap gap-2">
                {currentBuilding?.floors?.map((floor) => (
                  <button
                    key={floor.floorId}
                    type="button"
                    onClick={() => {
                      setSelectedFloorId(floor.floorId);
                      setSelectedRoom(null);
                    }}
                    className={`relative px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-medium transition
											${
                        floor.floorId === selectedFloorId
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                      }`}
                  >
                    {floor.floorName}
                    {isFloorFull(floor) && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Full
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Map canvas */}
          <div className="relative flex-1 min-h-[320px] sm:min-h-[380px] bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-start sm:justify-center overflow-x-auto overflow-y-hidden px-2">
            {loading && (
              <div className="text-sm text-slate-500">Loading map...</div>
            )}
            {!loading && currentFloor && currentFloor.rooms.length === 0 && (
              <div className="text-sm text-slate-500">
                No rooms found for this floor.
              </div>
            )}

            {!loading && currentFloor && currentFloor.rooms.length > 0 && (
              <>
                {layoutVariant === "gamma" && (
                  <div className="relative min-w-[560px] sm:min-w-0 w-full max-w-[640px] aspect-[4/3] bg-white rounded-2xl border border-slate-200 shadow-inner flex flex-col">
                    <div className="flex-0 grid grid-cols-5 gap-2 p-3 border-b border-slate-100">
                      {top.map((room) => renderRoomTile(room, "h-16"))}
                    </div>

                    <div className="flex-1 grid grid-cols-[80px_minmax(0,_1fr)_80px] gap-2 px-3 py-4">
                      <div className="flex flex-col gap-2">
                        {left.map((room) =>
                          renderRoomTile(room, "flex-1 min-h-[52px]"),
                        )}
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="w-full max-w-xs h-32 sm:h-40 rounded-2xl border border-dashed border-slate-300 bg-sky-50 flex flex-col items-center justify-center text-xs text-sky-800">
                          <span className="font-semibold mb-1">
                            Common Area
                          </span>
                          <span className="text-[10px] text-sky-700">
                            Collaboration & waiting space
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {right.map((room) =>
                          renderRoomTile(room, "flex-1 min-h-[52px]"),
                        )}
                      </div>
                    </div>

                    <div className="flex-0 grid grid-cols-5 gap-2 p-3 border-t border-slate-100">
                      {bottom.map((room) => renderRoomTile(room, "h-16"))}
                    </div>
                  </div>
                )}

                {layoutVariant === "alphaStyle" && (
                  <div className="relative min-w-[560px] sm:min-w-0 w-full max-w-[680px] aspect-[4/3] bg-white rounded-2xl border border-slate-200 shadow-inner p-3 sm:p-4 grid grid-rows-[auto_minmax(0,_1fr)_auto] gap-2">
                    <div className="grid grid-cols-4 gap-2">
                      {filteredRooms
                        .slice(0, 4)
                        .map((room) => renderRoomTile(room, "h-14"))}
                    </div>

                    <div className="grid grid-cols-[88px_minmax(0,_1fr)_88px] gap-2">
                      <div className="flex flex-col gap-2">
                        {filteredRooms
                          .slice(4, 8)
                          .map((room) =>
                            renderRoomTile(room, "flex-1 min-h-[48px]"),
                          )}
                      </div>

                      <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 flex flex-col items-center justify-center text-indigo-700">
                        <span className="text-xs font-semibold">Atrium</span>
                        <span className="text-[10px] opacity-80">
                          Alpha Wing Hub
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {filteredRooms
                          .slice(8, 12)
                          .map((room) =>
                            renderRoomTile(room, "flex-1 min-h-[48px]"),
                          )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {filteredRooms
                        .slice(12, 16)
                        .map((room) => renderRoomTile(room, "h-14"))}
                    </div>
                  </div>
                )}

                {layoutVariant === "betaStyle" && (
                  <div className="relative min-w-[560px] sm:min-w-0 w-full max-w-[680px] aspect-[4/3] bg-white rounded-2xl border border-slate-200 shadow-inner p-3 sm:p-4 grid grid-cols-[1fr_minmax(0,_1.15fr)_1fr] gap-3">
                    <div className="grid grid-cols-1 gap-2">
                      {filteredRooms
                        .filter((_, index) => index % 2 === 0)
                        .slice(0, 8)
                        .map((room) => renderRoomTile(room, "h-[46px]"))}
                    </div>

                    <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-3">
                      <div className="text-[11px] font-semibold tracking-wide uppercase text-emerald-700 mb-2">
                        Main Corridor
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {filteredRooms
                          .slice(16, 24)
                          .map((room) =>
                            renderRoomTile(
                              room,
                              "h-[52px]",
                              "text-[10px] sm:text-[11px]",
                            ),
                          )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {filteredRooms
                        .filter((_, index) => index % 2 === 1)
                        .slice(0, 8)
                        .map((room) => renderRoomTile(room, "h-[46px]"))}
                    </div>
                  </div>
                )}

                {layoutVariant === "deltaStyle" && (
                  <div className="relative min-w-[560px] sm:min-w-0 w-full max-w-[700px] aspect-[4/3] bg-white rounded-2xl border border-slate-200 shadow-inner p-3 sm:p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {chunkRooms(filteredRooms, 3).map((pod, podIndex) => (
                        <div
                          key={`pod-${podIndex}`}
                          className="rounded-2xl border border-amber-200 bg-amber-50/60 p-2.5"
                        >
                          <div className="text-[10px] font-semibold tracking-wide uppercase text-amber-700 mb-1.5">
                            Cluster {podIndex + 1}
                          </div>
                          <div className="grid grid-cols-1 gap-1.5">
                            {pod.map((room) =>
                              renderRoomTile(
                                room,
                                "h-[44px]",
                                "text-[10px] sm:text-[11px]",
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {layoutVariant === "epsilonStyle" && (
                  <div className="relative min-w-[560px] sm:min-w-0 w-full max-w-[700px] aspect-[4/3] bg-white rounded-2xl border border-slate-200 shadow-inner p-3 sm:p-4">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3 h-full overflow-y-auto">
                      <div className="text-[11px] font-semibold tracking-wide uppercase text-rose-700 mb-2">
                        Zigzag Route
                      </div>
                      <div className="space-y-2">
                        {chunkRooms(filteredRooms, 5).map((row, rowIndex) => {
                          const renderedRow =
                            rowIndex % 2 === 1 ? [...row].reverse() : row;

                          return (
                            <div
                              key={`zigzag-${rowIndex}`}
                              className="grid grid-cols-5 gap-2"
                            >
                              {renderedRow.map((room) =>
                                renderRoomTile(
                                  room,
                                  "h-[46px]",
                                  "text-[10px] sm:text-[11px]",
                                ),
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Room details panel */}
        <aside className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 flex flex-col gap-4">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Room details
          </div>

          {!selectedRoom && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-sm">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <TagIcon className="w-5 h-5 text-slate-500" />
              </div>
              <p className="font-medium text-slate-700 mb-1">Select a room</p>
              <p className="text-xs text-slate-500">
                Click on an available room tile to view details and book.
              </p>
            </div>
          )}

          {selectedRoom && (
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Selected room
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {selectedRoom.locationCode}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedRoom.buildingName} • {selectedRoom.floorName}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500 mb-0.5">
                    Status
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusStyles(selectedRoom.status)}`}
                  >
                    {selectedRoom.status === "AVAILABLE"
                      ? "Available"
                      : selectedRoom.status === "UNAVAILABLE"
                        ? "In Use"
                        : "Maintenance"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500 mb-0.5">
                    Rating
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {selectedRoom.score != null
                      ? selectedRoom.score.toFixed(1)
                      : "N/A"}
                  </div>
                </div>
              </div>

              {roomDetailLoading && (
                <div className="text-xs text-slate-500">
                  Loading detailed information...
                </div>
              )}

              {roomDetailError && !roomDetailLoading && (
                <div className="text-xs text-rose-500">{roomDetailError}</div>
              )}

              {roomDetail && !roomDetailLoading && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-500 mb-0.5">
                        Capacity
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        {roomDetail.capacity != null
                          ? roomDetail.capacity
                          : "N/A"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-500 mb-0.5">
                        Current user
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        {roomDetail.currentUserName || "No active check-in"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                    <div className="text-[11px] text-slate-500 mb-0.5">
                      Check-in time
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {formatCheckInDateTime(roomDetail.checkInTime)}
                    </div>
                  </div>

                  {roomDetail.amenities && roomDetail.amenities.length > 0 && (
                    <div className="text-xs">
                      <div className="text-[11px] text-slate-500 mb-1">
                        Amenities
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {roomDetail.amenities.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                          >
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-500">
                        Feedback from users
                      </div>
                      <div className="text-[11px] font-medium text-slate-400">
                        {roomFeedbackTotal} review
                        {roomFeedbackTotal === 1 ? "" : "s"}
                      </div>
                    </div>

                    {roomFeedbackLoading && (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-slate-500">
                        Loading feedback...
                      </div>
                    )}

                    {roomFeedbackError && !roomFeedbackLoading && (
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-4 text-rose-600">
                        {roomFeedbackError}
                      </div>
                    )}

                    {!roomFeedbackLoading &&
                      !roomFeedbackError &&
                      roomFeedbacks.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-slate-500">
                          No feedback yet for this room.
                        </div>
                      )}

                    {!roomFeedbackLoading &&
                      !roomFeedbackError &&
                      roomFeedbacks.length > 0 && (
                        <div className="space-y-3">
                          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {roomFeedbacks.map((feedback) => (
                              <div
                                key={feedback.id}
                                className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                              >
                                <div className="mb-1 flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">
                                      {formatFeedbackName(feedback.userName)}
                                    </div>
                                    <Rate
                                      disabled
                                      value={feedback.rating}
                                      className="text-xs"
                                    />
                                  </div>
                                  <div className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-orange-600">
                                    {feedback.rating}/5
                                  </div>
                                </div>

                                <p className="text-xs leading-5 text-slate-600">
                                  {feedback.description ||
                                    "No detailed feedback provided."}
                                </p>
                              </div>
                            ))}
                          </div>

                          {roomFeedbackTotal > FEEDBACK_PAGE_SIZE && (
                            <div className="flex justify-end">
                              <Pagination
                                current={roomFeedbackPage}
                                pageSize={FEEDBACK_PAGE_SIZE}
                                total={roomFeedbackTotal}
                                size="small"
                                showSizeChanger={false}
                                onChange={(page) => setRoomFeedbackPage(page)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </>
              )}

              <button
                type="button"
                disabled={selectedRoom.status !== "AVAILABLE"}
                onClick={handleBooking}
                className="mt-auto w-full inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Booking this room
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default RoomMapPage;
