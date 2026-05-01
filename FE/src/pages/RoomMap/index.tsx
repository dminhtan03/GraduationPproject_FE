import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Pagination, Rate, message } from "antd";
import { TagIcon, ClockIcon } from "@heroicons/react/24/outline";
import {
  roomService,
  type RoomAcademicScheduleItem,
  type RoomsMapBuilding,
  type RoomsMapResponse,
  type RoomStatusItem,
} from "../../services/roomService";
import { getProfile } from "../../services/authService";
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
  normalizeLocalDateTime,
  toDateInputValue,
  toTotalMinutes,
} from "../../utils";
import DatePickerField from "../../components/common/DatePickerField";
import AnimatedDropdown, {
  type AnimatedDropdownOption,
} from "../../components/common/AnimatedDropdown";
import BookingLockCountdown from "../../components/common/BookingLockCountdown";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { extractApiMessage } from "../../utils/errorHandlers";
import { useRealtimeClock, useRoomStatusWebSocket } from "../../hooks";
import type { UserProfile } from "../../types";
import RoomTile from "../../components/common/RoomTile";
import {
  FEEDBACK_PAGE_SIZE,
  ROOM_LAYOUT_STORAGE_KEY,
  roomMapStatusFilterOptions,
} from "../../constants/roomMap";
import type {
  FloorDecoration,
  RawMapBuilding,
  RawMapRoom,
  RoomDetail,
} from "../../types/roomMap";
import {
  chunkRooms,
  formatCheckInDateTime,
  formatFeedbackName,
  formatScheduleDate,
  formatScheduleDays,
  formatScheduleTime,
  resolveLayoutVariant,
  resolveLocationCode,
  resolveRoomId,
} from "../../utils/roomMapHelpers";

const RoomMapPage: React.FC = () => {
  const navigate = useNavigate();
  const currentTimeRange = useMemo(() => getCurrentTimeRange(), []);
  const clockTick = useRealtimeClock();

  const [buildings, setBuildings] = useState<RoomsMapBuilding[]>([]);
  const [decorations, setDecorations] = useState<FloorDecoration[]>([]);
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
  const [roomSchedules, setRoomSchedules] = useState<
    RoomAcademicScheduleItem[]
  >([]);
  const [roomSchedulesLoading, setRoomSchedulesLoading] = useState(false);
  const [roomSchedulesError, setRoomSchedulesError] = useState<string | null>(
    null,
  );
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  const showToast = (type: MessageType, nextMessage: string) => {
    setToastPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setToastPopup((current) =>
        current && current.message === nextMessage ? null : current,
      );
    }, 3000);
  };

  useRoomStatusWebSocket({
    floorId: selectedFloorId,
    onStatusChange: (roomId, nextStatus) => {
      setBuildings((prev) =>
        prev.map((building) => ({
          ...building,
          floors: (building.floors || []).map((floor) => ({
            ...floor,
            rooms: (floor.rooms || []).map((room) =>
              String(
                room.roomId || room.id || room.roomID || room.room_id || "",
              ) === roomId
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
    const loadProfile = async () => {
      try {
        const response = await getProfile();
        const raw = response.data as
          | { data?: UserProfile }
          | UserProfile
          | null;
        const nested =
          raw && typeof raw === "object" && "data" in raw
            ? raw.data
            : undefined;
        setUserProfile((nested || raw || null) as UserProfile | null);
      } catch {
        setUserProfile(null);
      }
    };

    loadProfile();
  }, []);

  const applyRoomsMapData = useCallback((data: RoomsMapResponse) => {
    const list: RawMapBuilding[] = Array.isArray(data.buildingResponse)
      ? (data.buildingResponse as RawMapBuilding[])
      : [];

    const normalizedList = list.map((building) => ({
      ...building,
      floors: sortFloorsByLevel(building.floors),
    }));

    setBuildings(normalizedList as RoomsMapBuilding[]);

    if (normalizedList.length === 0) {
      setSelectedBuildingId(null);
      setSelectedFloorId(null);
      return;
    }

    setSelectedBuildingId((prevBuildingId) => {
      const resolvedBuilding =
        normalizedList.find((b) => b.buildingId === prevBuildingId) ||
        normalizedList[0];

      setSelectedFloorId((prevFloorId) => {
        const resolvedFloor = resolvedBuilding?.floors?.find(
          (floor) => floor.floorId === prevFloorId,
        );

        return (
          resolvedFloor?.floorId ||
          resolvedBuilding?.floors?.[0]?.floorId ||
          null
        );
      });

      return resolvedBuilding?.buildingId || null;
    });
  }, []);

  useEffect(() => {
    const cached = roomService.getRoomsMapCached();
    const hasCached = Boolean(cached);

    if (cached) {
      applyRoomsMapData(cached);
      setLoading(false);
    }

    const fetchData = async () => {
      if (!hasCached) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await roomService.getRoomsMap();
        applyRoomsMapData(data);
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
  }, [applyRoomsMapData]);

  useEffect(() => {
    const fetchDecorations = async () => {
      if (!selectedFloorId) {
        setDecorations([]);
        return;
      }
      try {
        const decorData =
          await roomService.getFloorDecorations(selectedFloorId);
        setDecorations(decorData || []);
      } catch (err) {
        console.error("Failed to load decorations:", err);
        setDecorations([]);
      }
    };

    fetchDecorations();
  }, [selectedFloorId]);

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
          const roomRecord = r as Record<string, unknown>;
          const resolvedRoomId = resolveRoomId(r as RawMapRoom);
          const baseStatus =
            (roomRecord.status as MapRoomStatus) || "AVAILABLE";
          const override = overrideStatuses[resolvedRoomId];

          const score =
            typeof roomRecord.score === "number" &&
            !Number.isNaN(roomRecord.score)
              ? roomRecord.score
              : null;

          const xPosition =
            typeof roomRecord.x === "number"
              ? roomRecord.x
              : typeof roomRecord.xPosition === "number"
                ? roomRecord.xPosition
                : typeof roomRecord.xposition === "number"
                  ? roomRecord.xposition
                  : 0;

          const yPosition =
            typeof roomRecord.y === "number"
              ? roomRecord.y
              : typeof roomRecord.yPosition === "number"
                ? roomRecord.yPosition
                : typeof roomRecord.yposition === "number"
                  ? roomRecord.yposition
                  : 0;

          const width =
            typeof roomRecord.width === "number" ? roomRecord.width : 80;
          const height =
            typeof roomRecord.height === "number" ? roomRecord.height : 50;
          const positioned =
            typeof roomRecord.positioned === "boolean"
              ? roomRecord.positioned
              : false;

          return {
            roomId: resolvedRoomId,
            locationCode: resolveLocationCode(r as RawMapRoom),
            status: override ?? baseStatus,
            score,
            xPosition,
            yPosition,
            width,
            height,
            positioned,
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
    return floor.rooms.every(
      (r) => r.status !== "AVAILABLE" && r.status !== "LEARNING",
    );
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

  const isBookingLocked = useMemo(() => {
    if (!userProfile?.bookingLockedUntil) return false;
    const lockDate = new Date(userProfile.bookingLockedUntil);
    if (Number.isNaN(lockDate.getTime())) return false;
    return lockDate.getTime() > Date.now();
  }, [userProfile]);

  const canNavigateToBookRoom = useMemo(() => {
    if (!selectedRoom?.roomId) return false;
    return (
      selectedRoom.status === "AVAILABLE" || selectedRoom.status === "LEARNING"
    );
  }, [selectedRoom]);

  const handleRoomDrop = (targetRoomId: string) => {
    if (!draggedRoomId || draggedRoomId === targetRoomId || !currentFloorKey) {
      return;
    }

    const currentOrder =
      roomOrderByFloor[currentFloorKey] ||
      orderedRooms.map((item) => item.roomId);
    const dragIndex = currentOrder.indexOf(draggedRoomId);
    const targetIndex = currentOrder.indexOf(targetRoomId);
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
  };

  const renderRoomTile = (
    room: MapRoom,
    className = "h-16",
    textClassName = "text-[11px] sm:text-xs",
  ) => (
    <RoomTile
      key={room.roomId}
      room={room}
      className={className}
      textClassName={textClassName}
      onSelect={handleRoomClick}
      isDragOver={dragOverRoomId === room.roomId}
      isDragging={draggedRoomId === room.roomId}
      onDragStart={(roomId) => setDraggedRoomId(roomId)}
      onDragEnd={() => {
        setDraggedRoomId(null);
        setDragOverRoomId(null);
      }}
      onDragEnter={(roomId) => setDragOverRoomId(roomId)}
      onDragLeave={(roomId) => {
        if (dragOverRoomId === roomId) {
          setDragOverRoomId(null);
        }
      }}
      onDrop={handleRoomDrop}
    />
  );

  const handleApplyFilters = async () => {
    setFilterError(null);
    setOverrideStatuses({});

    const startTime = buildDateTime(startDate, startHour, startMinute);
    const endTime = buildDateTime(endDate, endHour, endMinute);

    if (!currentBuilding || !currentFloor) return;

    if (!startTime || !endTime) {
      const nextError = "Please select both start and end time.";
      setFilterError(nextError);
      showToast("warning", nextError);
      return;
    }

    const isBackendDateTime = (value: string) => {
      if (!LOCAL_DATE_TIME_PATTERN.test(value)) return false;
      return !Number.isNaN(new Date(value).getTime());
    };

    if (!isBackendDateTime(startTime) || !isBackendDateTime(endTime)) {
      const nextError =
        "Invalid date/time format. Expected yyyy-MM-ddTHH:mm:ss.";
      setFilterError(nextError);
      showToast("warning", nextError);
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      const nextError = "End time must be later than start time.";
      setFilterError(nextError);
      showToast("warning", nextError);
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
      if (availableSet.size > 0) {
        showToast("success", "Time filter applied successfully.");
      } else {
        showToast("warning", "No rooms are available in selected time range.");
      }
    } catch (e: unknown) {
      const nextError = extractApiMessage(e, "Unable to apply time filter");
      setFilterError(nextError);
      showToast("error", nextError);
    } finally {
      setFilterLoading(false);
    }
  };

  const handleRoomClick = async (room: MapRoom) => {
    if (!currentBuilding || !currentFloor) return;

    const normalizedRoomId = String(room.roomId || "").trim();

    setSelectedRoom({
      ...room,
      roomId: normalizedRoomId,
      buildingName: currentBuilding.buildingName,
      floorName: currentFloor.floorName,
    });

    setRoomDetail(null);
    setRoomDetailError(null);
    setRoomDetailLoading(true);
    setRoomSchedules([]);
    setRoomSchedulesError(null);
    setRoomSchedulesLoading(true);
    setRoomFeedbacks([]);
    setRoomFeedbackTotal(0);
    setRoomFeedbackPage(1);
    setRoomFeedbackError(null);

    if (!normalizedRoomId) {
      setRoomDetailLoading(false);
      setRoomSchedulesLoading(false);
      setRoomDetailError(
        "Cannot load room details because room id is missing from map data.",
      );
      return;
    }

    try {
      const detail = await roomService.getRoomDetail(normalizedRoomId);
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

    try {
      const schedules =
        await roomService.getAcademicSchedulesByRoom(normalizedRoomId);
      setRoomSchedules(schedules);
    } catch (e: unknown) {
      setRoomSchedulesError(extractApiMessage(e, "Unable to load schedules"));
      setRoomSchedules([]);
    } finally {
      setRoomSchedulesLoading(false);
    }
  };

  useEffect(() => {
    const roomId = selectedRoom?.roomId;

    if (!roomId) {
      setRoomSchedules([]);
      setRoomSchedulesError(null);
      setRoomSchedulesLoading(false);
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

    const normalizedRoomId = String(selectedRoom.roomId || "").trim();

    if (!normalizedRoomId) {
      message.warning(
        "Cannot book this room because room id is missing. Please choose another room.",
      );
      return;
    }

    if (
      selectedRoom.status !== "AVAILABLE" &&
      selectedRoom.status !== "LEARNING"
    ) {
      message.warning("This room is currently not available for booking.");
      return;
    }

    if (isBookingLocked) {
      message.warning(
        "Booking is temporarily locked. Please wait for countdown.",
      );
      return;
    }

    // Pass roomId in URL and full room data in state
    navigate(ROUTES.ROOM_DETAIL.replace(":roomId", normalizedRoomId), {
      state: {
        room: {
          id: normalizedRoomId,
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
            disabled={!canNavigateToBookRoom}
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
            <AnimatedDropdown<"ALL" | MapRoomStatus>
              value={statusFilter}
              options={roomMapStatusFilterOptions}
              onChange={(nextValue) => setStatusFilter(nextValue)}
              className="w-full max-w-[240px] lg:w-40"
              buttonClassName="h-10 border-slate-200 bg-white shadow-sm"
              ariaLabel="Filter map rooms by status"
            />
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
                  <AnimatedDropdown<string>
                    value={startHour}
                    options={startHourDropdownOptions}
                    onChange={(nextValue) => setStartHour(nextValue)}
                    buttonClassName="h-9 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums shadow-sm"
                    menuClassName="max-h-56 overflow-y-auto"
                    optionClassName="text-xs tabular-nums"
                    ariaLabel="Select start hour"
                  />
                  <AnimatedDropdown<string>
                    value={startMinute}
                    options={startMinuteDropdownOptions}
                    onChange={(nextValue) => setStartMinute(nextValue)}
                    buttonClassName="h-9 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums shadow-sm"
                    menuClassName="max-h-56 overflow-y-auto"
                    optionClassName="text-xs tabular-nums"
                    ariaLabel="Select start minute"
                  />
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
                  <AnimatedDropdown<string>
                    value={endHour}
                    options={endHourDropdownOptions}
                    onChange={(nextValue) => setEndHour(nextValue)}
                    buttonClassName="h-9 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums shadow-sm"
                    menuClassName="max-h-56 overflow-y-auto"
                    optionClassName="text-xs tabular-nums"
                    ariaLabel="Select end hour"
                  />
                  <AnimatedDropdown<string>
                    value={endMinute}
                    options={endMinuteDropdownOptions}
                    onChange={(nextValue) => setEndMinute(nextValue)}
                    buttonClassName="h-9 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums shadow-sm"
                    menuClassName="max-h-56 overflow-y-auto"
                    optionClassName="text-xs tabular-nums"
                    ariaLabel="Select end minute"
                  />
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
          <div className="flex items-center gap-1.5 text-purple-700">
            <span className="w-3 h-3 rounded-full bg-purple-400" />
            <span>Learning</span>
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
          <div className="relative flex-1 min-h-[400px] sm:min-h-[500px] bg-slate-50 rounded-2xl flex items-center justify-start sm:justify-center overflow-x-auto overflow-y-hidden px-2">
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
                {currentFloor.rooms.some((r) => r.positioned) ? (
                  <div className="w-full flex justify-center py-4 bg-slate-50 rounded-2xl">
                    <div className="relative w-[1000px] h-[600px] bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
                      {/* Render decorations first so they are in the background */}
                      {decorations.map((decor) => (
                        <div
                          key={decor.id}
                          className={`absolute rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all ${
                            decor.type === "LOBBY"
                              ? "bg-blue-50/50 border-blue-200 text-blue-400"
                              : "bg-slate-50/50 border-slate-200 text-slate-400"
                          }`}
                          style={{
                            left: decor.x,
                            top: decor.y,
                            width: decor.width,
                            height: decor.height,
                            zIndex: 0,
                          }}
                        >
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 select-none">
                            {decor.label}
                          </span>
                        </div>
                      ))}

                      {currentFloor.rooms.map((room) => (
                        <div
                          key={room.roomId}
                          style={{
                            position: "absolute",
                            left: room.xPosition || 0,
                            top: room.yPosition || 0,
                            width: room.width || 80,
                            height: room.height || 50,
                            zIndex: 10,
                          }}
                        >
                          {renderRoomTile(room, "w-full h-full", "text-[10px]")}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
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
                            <span className="text-xs font-semibold">
                              Atrium
                            </span>
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
                            {chunkRooms(filteredRooms, 5).map(
                              (row, rowIndex) => {
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
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
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
                Click on a room tile to view details and book.
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
                      : selectedRoom.status === "LEARNING"
                        ? "Learning"
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

                  {roomSchedulesLoading && (
                    <div className="text-xs text-slate-500">
                      Loading room schedule...
                    </div>
                  )}

                  {!roomSchedulesLoading && roomSchedulesError && (
                    <div className="text-xs text-rose-500">
                      {roomSchedulesError}
                    </div>
                  )}

                  {!roomSchedulesLoading && roomSchedules.length > 0 && (
                    <div className="text-xs">
                      <div className="mb-1 text-[11px] text-slate-500">
                        Schedule
                      </div>
                      <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                        {roomSchedules.slice(0, 4).map((schedule) => (
                          <div
                            key={schedule.id}
                            className="rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2"
                          >
                            <div className="text-[11px] font-semibold text-orange-700">
                              {formatScheduleDays(schedule.daysOfWeek)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-700">
                              {formatScheduleTime(schedule.startTime)} -{" "}
                              {formatScheduleTime(schedule.endTime)}
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {formatScheduleDate(schedule.fromDate)} -{" "}
                              {formatScheduleDate(schedule.toDate)}
                            </div>
                            {schedule.description && (
                              <div className="mt-1 text-[10px] text-slate-600">
                                {schedule.description}
                              </div>
                            )}
                          </div>
                        ))}
                        {roomSchedules.length > 4 && (
                          <div className="text-[10px] text-slate-500">
                            +{roomSchedules.length - 4} more schedule entries
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

              <BookingLockCountdown
                lockedUntil={userProfile?.bookingLockedUntil}
                cancellationCount={userProfile?.cancellationCount}
                compact
                className="mb-3"
              />

              <button
                type="button"
                disabled={!canNavigateToBookRoom}
                onClick={handleBooking}
                className="mt-auto w-full inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Booking this room
              </button>
            </div>
          )}
        </aside>
      </div>

      {toastPopup && (
        <CustomMessage
          type={toastPopup.type}
          message={toastPopup.message}
          onClose={() => setToastPopup(null)}
        />
      )}
    </div>
  );
};

export default RoomMapPage;
