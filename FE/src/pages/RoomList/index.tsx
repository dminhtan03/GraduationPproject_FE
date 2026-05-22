import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "antd";
import { useNavigate } from "react-router-dom";
import { ClockIcon } from "@heroicons/react/24/outline";
import { roomService } from "../../services/roomService";
import { extractApiMessage } from "../../utils/errorHandlers";
import DatePickerField from "../../components/common/DatePickerField";
import AnimatedDropdown, {
  type AnimatedDropdownOption,
} from "../../components/common/AnimatedDropdown";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { useRoomListFilter } from "../../hooks/useRoomListFilter";
import {
  buildDateTime,
  isBackendDateTime,
  normalizeLocalDateTime,
} from "../../utils";
import {
  buildTimeStatusOverrides,
  normalizeRoomsMap,
} from "../../utils/roomList";
import CustomPagination from "../../components/common/CustomPagination";
import RoomCard from "../../components/ui/RoomCard";
import {
  ROOM_LIST_PAGE_SIZE,
  roomStatusFilterOptions,
} from "../../constants/roomList";
import type {
  FilterType,
  RoomListItem,
  RoomListStatus,
} from "../../types/roomList";

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedFloorId, setSelectedFloorId] = useState("all");
  const [timeFilterActive, setTimeFilterActive] = useState(false);
  const [timeStatusOverrides, setTimeStatusOverrides] = useState<
    Record<string, RoomListStatus>
  >({});
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

  const {
    startDate,
    setStartDate,
    startHour,
    setStartHour,
    startMinute,
    setStartMinute,
    endDate,
    setEndDate,
    endHour,
    setEndHour,
    endMinute,
    setEndMinute,
    startHourDropdownOptions,
    startMinuteDropdownOptions,
    endHourDropdownOptions,
    endMinuteDropdownOptions,
    nowParts,
    minEndDate,
    clearTimeFilter,
  } = useRoomListFilter();

  const loadRooms = useCallback(async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const mapData = await roomService.getRoomsMap();
      setRooms(normalizeRoomsMap(mapData));
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to load room data"));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = roomService.getRoomsMapCached();
    const hasCached = Boolean(cached);

    if (cached) {
      setRooms(normalizeRoomsMap(cached));
      setLoading(false);
    }

    loadRooms(hasCached);
  }, [loadRooms]);

  // Search state
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
    page * ROOM_LIST_PAGE_SIZE,
    (page + 1) * ROOM_LIST_PAGE_SIZE,
  );

  const totalFiltered = filteredRooms.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltered / ROOM_LIST_PAGE_SIZE),
  );

  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const handleApplyTimeFilter = async () => {
    setPage(0);

    const startTime = buildDateTime(startDate, startHour, startMinute);
    const endTime = buildDateTime(endDate, endHour, endMinute);

    if (!startTime && !endTime) {
      setTimeFilterActive(false);
      setTimeStatusOverrides({});
      return;
    }

    if (!startTime || !endTime) {
      showToast("warning", "Please select both start time and end time.");
      return;
    }

    if (!isBackendDateTime(startTime) || !isBackendDateTime(endTime)) {
      showToast(
        "warning",
        "Invalid date/time format. Expected yyyy-MM-ddTHH:mm:ss.",
      );
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      showToast("warning", "End time must be later than start time.");
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
          const searchResult = await roomService.searchAvailableRoomsWithMeta({
            buildingId: pair.buildingId,
            floorId: pair.floorId,
            startTime: normalizeLocalDateTime(startTime),
            endTime: normalizeLocalDateTime(endTime),
          });

          return {
            key: `${pair.buildingId}|${pair.floorId}`,
            message: searchResult.message,
            statusMap: new Map(
              searchResult.items.map((room) => [
                room.roomId,
                room.status as RoomListStatus,
              ]),
            ),
          };
        }),
      );

      const floorAvailability = new Map(
        floorResults.map((item) => [item.key, item.statusMap]),
      );

      const overrides = buildTimeStatusOverrides(
        scopedRooms,
        floorAvailability,
      );

      setTimeStatusOverrides(overrides);
      setTimeFilterActive(true);

      const backendMessage = floorResults.find((item) => item.message)?.message;
      if (backendMessage) {
        showToast("success", backendMessage);
      }
    } catch (e: unknown) {
      showToast("error", extractApiMessage(e, "Unable to apply time filter"));
      setTimeFilterActive(false);
      setTimeStatusOverrides({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        <div className="w-full flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/room-map")}
            className="w-full sm:w-auto sm:self-start px-4 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold shadow hover:bg-orange-600 transition"
          >
            Show Room Map
          </button>
        </div>
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
              clearTimeFilter();
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`room-skeleton-${index}`}
              className="rounded-[20px] border border-gray-200 bg-white shadow-sm overflow-hidden room-card-enter"
              style={{ animationDelay: `${80 + index * 60}ms` }}
            >
              <div className="h-48 bg-slate-200 room-card-skeleton" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-2/3 bg-slate-200 rounded-md room-card-skeleton" />
                <div className="h-4 w-1/3 bg-slate-200 rounded-md room-card-skeleton" />
                <div className="h-4 w-full bg-slate-200 rounded-md room-card-skeleton" />
                <div className="h-10 w-full bg-slate-200 rounded-xl room-card-skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {pagedRooms.map((room, index) => (
            <div
              key={room.id}
              className="room-card-enter"
              style={{ animationDelay: `${80 + index * 60}ms` }}
            >
              <RoomCard
                room={room}
                timeFilterActive={timeFilterActive}
                timeRange={{
                  startDate,
                  startHour,
                  startMinute,
                  endDate,
                  endHour,
                  endMinute,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!loading && pagedRooms.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center flex flex-col items-center">
          <svg
            className="w-12 h-12 text-slate-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
          <div className="text-base font-semibold text-slate-700">
            No rooms found
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Try adjusting your filters or search terms.
          </div>
        </div>
      )}

      <CustomPagination
        currentPage={page + 1}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p - 1)}
        totalItems={totalFiltered}
        pageSize={ROOM_LIST_PAGE_SIZE}
        className="mt-6 rounded-2xl border border-orange-100 bg-white/90 px-3 py-3 shadow-sm sm:px-4"
      />

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

export default DashboardPage;
