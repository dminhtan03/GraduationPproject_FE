import { api } from "./api";
import type { Room, RoomStatus } from "../types";

export interface GetRoomParams {
  page: number;
  size: number;
  status?: RoomStatus;
  minCapacity?: number;
}

export interface RoomResponse {
  items: Room[];
  total: number;
}

// Flatten rooms from buildingResponse -> floors -> rooms
function flattenRooms(data: any, params: GetRoomParams): Room[] {
  if (!data || !Array.isArray(data.buildingResponse)) return [];
  let rooms: Room[] = [];
  data.buildingResponse.forEach((building: any) => {
    if (Array.isArray(building.floors)) {
      building.floors.forEach((floor: any) => {
        if (Array.isArray(floor.rooms)) {
          floor.rooms.forEach((room: any) => {
            rooms.push({
              id: room.roomId || room.id,
              roomName: room.locationCode || room.roomName || "",
              floorInfo: floor.floorName || "",
              building: building.buildingName || "",
              slot: room.slot || 0,
              status: room.status,
            });
          });
        }
      });
    }
  });
  // Filter by status
  if (params.status) rooms = rooms.filter((r) => r.status === params.status);
  // Filter by minCapacity
  if (params.minCapacity)
    rooms = rooms.filter((r) => r.slot >= params.minCapacity);
  return rooms;
}

export const roomService = {
  async getRooms(params: GetRoomParams): Promise<RoomResponse> {
    const res = await api.get<any>("/api/v1/dashboard/rooms-map", {
      params: {
        page: params.page,
        size: params.size,
        status: params.status,
        minCapacity: params.minCapacity,
      },
    });

    const payload = res.data || {};
    const data = payload.data ?? payload;

    // Backend có thể đã filter & phân trang; flattenRooms chỉ chuẩn hóa structure
    const rooms = flattenRooms(data, params);

    const meta = payload.meta as { total?: number | null } | undefined;

    return {
      items: rooms,
      total:
        typeof meta?.total === "number" && meta.total >= 0
          ? meta.total
          : rooms.length,
    };
  },
};
