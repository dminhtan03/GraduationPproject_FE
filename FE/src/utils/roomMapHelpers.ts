import type { RoomsMapBuilding } from "../services/roomService";
import type { BuildingLayoutVariant, RawMapRoom } from "../types/roomMap";

export const formatFeedbackName = (name?: string | null) => {
  const trimmed = String(name || "").trim();
  return trimmed || "Anonymous user";
};

export const formatCheckInDateTime = (value?: string | null) => {
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

export const formatScheduleTime = (value?: string | null) => {
  if (!value) return "N/A";
  const raw = String(value).trim();
  if (!raw) return "N/A";
  return raw.length >= 5 ? raw.slice(0, 5) : raw;
};

export const formatScheduleDate = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatScheduleDays = (value?: string | null) => {
  if (!value) return "N/A";
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
};

export const chunkRooms = <T>(rooms: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < rooms.length; index += size) {
    result.push(rooms.slice(index, index + size));
  }
  return result;
};

export const resolveRoomId = (room: RawMapRoom): string => {
  const candidates = [room.roomId, room.id, room.roomID, room.room_id];
  const firstValid = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return typeof firstValid === "string" ? firstValid.trim() : "";
};

export const resolveLocationCode = (room: RawMapRoom): string => {
  const candidates = [room.locationCode, room.roomName, room.roomId, room.id];
  const firstValid = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return typeof firstValid === "string" ? firstValid.trim() : "Unknown room";
};

export const resolveLayoutVariant = (
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
