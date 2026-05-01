import { RECURRING_SERIES_DAYS } from "../constants/recurringSeries";
import type { RoomOption } from "../types/recurringSeries";

type UnknownRecord = Record<string, unknown>;

type RoomsMapShape = {
  buildingResponse?: unknown[];
};

export const formatDaysOfWeek = (daysString: string): string => {
  if (!daysString) return "";
  const days = daysString.split(",").map((d) => d.trim());
  return days
    .map((day) => {
      const found = RECURRING_SERIES_DAYS.find((item) => item.key === day);
      return found ? found.label : day;
    })
    .join(", ");
};

export const formatDateRange = (
  fromDate: string,
  untilDate?: string | null,
): string => {
  if (!fromDate) return "-";
  const from = fromDate.split("-").slice(1).reverse().join("/");
  if (!untilDate) return from;
  const until = untilDate.split("-").slice(1).reverse().join("/");
  return `${from} -> ${until}`;
};

export const formatTimeRange = (startTime: string, endTime: string): string => {
  return `${String(startTime).slice(0, 5)} - ${String(endTime).slice(0, 5)}`;
};

export const getRecurringSeriesStatusColor = (
  status: string,
): "success" | "error" | "warning" | "default" => {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") return "success";
  if (upper === "CANCELLED") return "error";
  if (upper === "PAUSED") return "warning";
  return "default";
};

export const toMinutesFromTime = (value: string): number => {
  if (!value) return Number.NaN;
  const parts = value.split(":");
  if (parts.length < 2) return Number.NaN;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.NaN;
  return hours * 60 + minutes;
};

export const toTimeWithSeconds = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(":");
  if (parts.length === 2) return `${trimmed}:00`;
  return trimmed;
};

export const buildRoomOptionsFromMap = (
  roomsMap: RoomsMapShape,
): RoomOption[] => {
  const buildingResponse = Array.isArray(roomsMap.buildingResponse)
    ? roomsMap.buildingResponse
    : [];
  const rooms: RoomOption[] = [];

  buildingResponse.forEach((building) => {
    if (!building || typeof building !== "object") return;
    const floors = Array.isArray((building as UnknownRecord).floors)
      ? ((building as UnknownRecord).floors as UnknownRecord[])
      : [];

    floors.forEach((floor) => {
      if (!floor || typeof floor !== "object") return;
      const floorRooms = Array.isArray((floor as UnknownRecord).rooms)
        ? ((floor as UnknownRecord).rooms as UnknownRecord[])
        : [];

      floorRooms.forEach((room) => {
        if (!room || typeof room !== "object") return;
        const roomRecord = room as UnknownRecord;
        const roomId =
          (typeof roomRecord.roomId === "string" && roomRecord.roomId) ||
          (typeof roomRecord.id === "string" && roomRecord.id) ||
          "";
        if (!roomId) return;

        const locationCode =
          (typeof roomRecord.locationCode === "string" &&
            roomRecord.locationCode) ||
          "";
        const roomName =
          (typeof roomRecord.roomName === "string" && roomRecord.roomName) ||
          locationCode ||
          roomId;

        rooms.push({
          id: roomId,
          locationCode,
          roomName,
        });
      });
    });
  });

  return rooms;
};
