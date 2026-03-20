import type { RoomStatus } from "../types";

// Extended status used in FE map (BE also has UNAVAILABLE, BROKEN)
export type MapRoomStatus = RoomStatus | "UNAVAILABLE" | "BROKEN";

export interface MapRoom {
  roomId: string;
  locationCode: string;
  status: MapRoomStatus;
  score?: number | null;
  // start add layout fields
  xPosition?: number;
  yPosition?: number;
  width?: number;
  height?: number;
  positioned?: boolean;
  // end add layout fields
}

export interface FloorWithRooms {
  floorId: string;
  floorName: string;
  rooms: MapRoom[];
}

export interface SelectedRoom extends MapRoom {
  buildingName: string;
  floorName: string;
}

const MAX_TOP_BOTTOM = 10;
const MAX_SIDE = 4;

export function splitRoomsForMap(rooms: MapRoom[]) {
  const top = rooms.slice(0, MAX_TOP_BOTTOM);
  const left = rooms.slice(MAX_TOP_BOTTOM, MAX_TOP_BOTTOM + MAX_SIDE);
  const right = rooms.slice(
    MAX_TOP_BOTTOM + MAX_SIDE,
    MAX_TOP_BOTTOM + MAX_SIDE * 2,
  );
  const bottom = rooms.slice(
    MAX_TOP_BOTTOM + MAX_SIDE * 2,
    MAX_TOP_BOTTOM * 2 + MAX_SIDE * 2,
  );

  return {
    top,
    left,
    right,
    bottom,
  };
}

export function getStatusStyles(status: MapRoomStatus) {
  if (status === "AVAILABLE") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  if (status === "UNAVAILABLE") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  if (status === "BROKEN") {
    return "border-slate-300 bg-slate-50 text-slate-600";
  }
  return "border-slate-200 bg-white text-slate-700";
}

// Extract numeric level from floor name, e.g. "Tầng 1" -> 1
function getFloorLevel(floorName: string): number {
  const match = floorName.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// Sort floors by level (1 -> 5) based on floorName
export function sortFloorsByLevel<T extends { floorName: string }>(
  floors: T[] | null | undefined,
): T[] {
  if (!floors || floors.length === 0) return [];
  return [...floors].sort(
    (a, b) => getFloorLevel(a.floorName) - getFloorLevel(b.floorName),
  );
}
