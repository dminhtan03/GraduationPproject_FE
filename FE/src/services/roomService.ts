import { api } from "./api";
import type { Room, RoomStatus } from "../types";
import type { MapRoomStatus } from "../utils";
import { API_CONFIG } from "../constants";
import { API_ENDPOINTS, buildUrl } from "../constants/endpoints";

export interface GetRoomParams {
  page: number;
  size: number;
  status?: RoomStatus;
  minCapacity?: number;
  startTime?: string;
  endTime?: string;
}

export interface RoomResponse {
  items: Room[];
  total: number;
}

// Raw structure from /api/v1/dashboard/rooms-map
export interface RoomsMapBuilding {
  buildingId: string;
  buildingName: string;
  floors: {
    floorId: string;
    floorName: string;
    rooms: any[];
  }[];
}

export interface RoomsMapResponse {
  buildingResponse: RoomsMapBuilding[];
}

export interface RoomStatusRequest {
  buildingId: string;
  floorId: string;
  startTime: string;
  endTime: string;
}

export interface RoomStatusItem {
  roomId: string;
  locationCode: string;
  status: MapRoomStatus;
  score: number | null;
}

type UnknownRecord = Record<string, unknown>;

const extractData = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as UnknownRecord;
  const firstData = body.data;

  if (firstData && typeof firstData === "object") {
    const nested = (firstData as UnknownRecord).data;
    return nested ?? firstData;
  }

  return firstData ?? raw;
};

const toAbsoluteImageUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  const base = (API_CONFIG.BASE_URL || "").replace(/\/+$/, "");
  if (!base) return trimmed;

  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
};

const normalizeRoomImages = (
  images: unknown,
): Array<{ id?: string; imageUrl?: string }> => {
  if (!Array.isArray(images)) return [];

  return images
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;

      const image = item as UnknownRecord;
      const imageUrl = toAbsoluteImageUrl(
        image.imageUrl ?? image.url ?? image.image ?? image.path,
      );

      return {
        id: typeof image.id === "string" ? image.id : undefined,
        imageUrl,
      };
    })
    .filter((img): img is { id?: string; imageUrl?: string } =>
      Boolean(img && (img.id || img.imageUrl)),
    );
};

const normalizeRoomDetail = (detail: unknown): UnknownRecord => {
  if (!detail || typeof detail !== "object") return {};

  const mapped = detail as UnknownRecord;
  return {
    ...mapped,
    images: normalizeRoomImages(mapped.images),
  };
};

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
  const minCapacity = params.minCapacity;
  if (typeof minCapacity === "number") {
    rooms = rooms.filter((r) => r.slot >= minCapacity);
  }
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
        startTime: params.startTime,
        endTime: params.endTime,
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

  async getRoomsMap(): Promise<RoomsMapResponse> {
    const res = await api.get<any>("/api/v1/dashboard/rooms-map");
    const data = res.data?.data || res.data || {};
    return data as RoomsMapResponse;
  },

  // Tìm phòng TRỐNG theo khoảng thời gian (BE: /api/v1/rooms/search)
  async searchAvailableRooms(
    payload: RoomStatusRequest,
  ): Promise<RoomStatusItem[]> {
    const res = await api.post<any>(API_ENDPOINTS.ROOMS.SEARCH, payload);

    const list = res.data?.data || res.data || [];

    const arr = Array.isArray(list) ? list : [];

    return arr.map((item: any) => ({
      roomId: item.seatId ?? item.roomId,
      locationCode: item.locationCode,
      status: (item.status as MapRoomStatus) ?? "AVAILABLE",
      score:
        typeof item.score === "number" && !Number.isNaN(item.score)
          ? item.score
          : null,
    }));
  },

  async getRoomDetail(roomId: string): Promise<any> {
    const res = await api.get<any>(
      buildUrl(API_ENDPOINTS.ROOMS.DETAIL, { id: roomId }),
    );
    const detail = normalizeRoomDetail(extractData(res));

    if (Array.isArray(detail.images) && detail.images.length > 0) {
      return detail;
    }

    try {
      const imageRes = await api.get<any>(`/api/v1/room-images/room/${roomId}`);
      const images = normalizeRoomImages(extractData(imageRes));
      return {
        ...detail,
        images,
      };
    } catch {
      return detail;
    }
  },
};
