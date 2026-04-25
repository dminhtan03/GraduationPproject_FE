import { api } from "./api";
import type { Room, RoomStatus } from "../types";
import type { MapRoomStatus } from "../utils";
import { API_CONFIG } from "../constants";
import { API_ENDPOINTS, buildUrl } from "../constants/endpoints";

type UnknownRecord = Record<string, unknown>;

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
    rooms: UnknownRecord[];
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

export interface RoomStatusSearchResponse {
  items: RoomStatusItem[];
  message?: string;
}

export interface RoomAcademicScheduleItem {
  id: string;
  roomId?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string;
  fromDate?: string;
  toDate?: string;
  description?: string | null;
}

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

  const normalized: Array<{ id?: string; imageUrl?: string }> = [];

  images.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const image = item as UnknownRecord;
    const imageUrl = toAbsoluteImageUrl(
      image.imageUrl ?? image.url ?? image.image ?? image.path,
    );
    const id = typeof image.id === "string" ? image.id : undefined;

    if (id || imageUrl) {
      normalized.push({ id, imageUrl });
    }
  });

  return normalized;
};

const normalizeRoomDetail = (detail: unknown): UnknownRecord => {
  if (!detail || typeof detail !== "object") return {};

  const mapped = detail as UnknownRecord;
  return {
    ...mapped,
    images: normalizeRoomImages(mapped.images),
  };
};

const extractResponseMessage = (payload: UnknownRecord): string | undefined => {
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  const meta = payload.meta;
  if (meta && typeof meta === "object") {
    const metaRecord = meta as UnknownRecord;
    if (typeof metaRecord.message === "string" && metaRecord.message.trim()) {
      return metaRecord.message.trim();
    }
  }

  return undefined;
};

const normalizeRoomStatusItems = (list: unknown): RoomStatusItem[] => {
  const arr = Array.isArray(list) ? list : [];

  return arr.map((item) => {
    const record =
      item && typeof item === "object"
        ? (item as UnknownRecord)
        : ({} as UnknownRecord);

    return {
      roomId:
        (typeof record.roomId === "string" && record.roomId) ||
        (typeof record.id === "string" && record.id) ||
        (typeof record.seatId === "string" && record.seatId) ||
        "",
      locationCode:
        (typeof record.locationCode === "string" && record.locationCode) || "",
      status:
        ((typeof record.status === "string"
          ? record.status
          : "AVAILABLE") as MapRoomStatus) || "AVAILABLE",
      score:
        typeof record.score === "number" && !Number.isNaN(record.score)
          ? record.score
          : null,
    };
  });
};

const requestSearchAvailableRooms = async (
  payload: RoomStatusRequest,
): Promise<RoomStatusSearchResponse> => {
  const res = await api.post<unknown>(API_ENDPOINTS.ROOMS.SEARCH, payload);
  const raw =
    res.data && typeof res.data === "object"
      ? (res.data as UnknownRecord)
      : ({} as UnknownRecord);
  const list = raw.data ?? raw;

  return {
    items: normalizeRoomStatusItems(list),
    message: extractResponseMessage(raw),
  };
};

// Flatten rooms from buildingResponse -> floors -> rooms
function flattenRooms(data: unknown, params: GetRoomParams): Room[] {
  if (!data || typeof data !== "object") return [];

  const buildingResponse = (data as UnknownRecord).buildingResponse;
  if (!Array.isArray(buildingResponse)) return [];

  let rooms: Room[] = [];

  buildingResponse.forEach((buildingEntry) => {
    if (!buildingEntry || typeof buildingEntry !== "object") return;

    const building = buildingEntry as UnknownRecord;
    const floors = building.floors;
    if (Array.isArray(floors)) {
      floors.forEach((floorEntry) => {
        if (!floorEntry || typeof floorEntry !== "object") return;

        const floor = floorEntry as UnknownRecord;
        const floorRooms = floor.rooms;

        if (Array.isArray(floorRooms)) {
          floorRooms.forEach((roomEntry) => {
            if (!roomEntry || typeof roomEntry !== "object") return;

            const room = roomEntry as UnknownRecord;
            rooms.push({
              id:
                (typeof room.roomId === "string" && room.roomId) ||
                (typeof room.id === "string" && room.id) ||
                "",
              roomName:
                (typeof room.locationCode === "string" && room.locationCode) ||
                (typeof room.roomName === "string" && room.roomName) ||
                "",
              floorInfo:
                (typeof floor.floorName === "string" && floor.floorName) || "",
              building:
                (typeof building.buildingName === "string" &&
                  building.buildingName) ||
                "",
              slot:
                typeof room.slot === "number"
                  ? room.slot
                  : Number(room.slot) || 0,
              status: (typeof room.status === "string"
                ? room.status
                : "AVAILABLE") as RoomStatus,
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
    const res = await api.get<unknown>("/api/v1/dashboard/rooms-map", {
      params: {
        page: params.page,
        size: params.size,
        status: params.status,
        minCapacity: params.minCapacity,
        startTime: params.startTime,
        endTime: params.endTime,
      },
    });

    const payload =
      res.data && typeof res.data === "object"
        ? (res.data as UnknownRecord)
        : ({} as UnknownRecord);
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
    const res = await api.get<unknown>("/api/v1/dashboard/rooms-map");
    const raw =
      res.data && typeof res.data === "object"
        ? (res.data as UnknownRecord)
        : ({} as UnknownRecord);
    const data = (raw.data as UnknownRecord) || raw;
    return data as unknown as RoomsMapResponse;
  },

  // Tìm phòng TRỐNG theo khoảng thời gian (BE: /api/v1/rooms/search)
  async searchAvailableRooms(
    payload: RoomStatusRequest,
  ): Promise<RoomStatusItem[]> {
    const result = await requestSearchAvailableRooms(payload);
    return result.items;
  },

  async searchAvailableRoomsWithMeta(
    payload: RoomStatusRequest,
  ): Promise<RoomStatusSearchResponse> {
    return requestSearchAvailableRooms(payload);
  },

  async getRoomDetail(roomId: string): Promise<UnknownRecord> {
    const res = await api.get<unknown>(
      buildUrl(API_ENDPOINTS.ROOMS.DETAIL, { id: roomId }),
    );
    const detail = normalizeRoomDetail(extractData(res));

    if (Array.isArray(detail.images) && detail.images.length > 0) {
      return detail;
    }

    try {
      const imageRes = await api.get<unknown>(
        `/api/v1/room-images/room/${roomId}`,
      );
      const images = normalizeRoomImages(extractData(imageRes));
      return {
        ...detail,
        images,
      };
    } catch {
      return detail;
    }
  },

  async getAcademicSchedulesByRoom(
    roomId: string,
  ): Promise<RoomAcademicScheduleItem[]> {
    const res = await api.get<unknown>(
      buildUrl(API_ENDPOINTS.ACADEMIC_SCHEDULES.BY_ROOM, { roomId }),
    );
    const payload = extractData(res);
    const list = Array.isArray(payload) ? payload : [];

    const normalizeText = (value: unknown): string | undefined => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      if (value === null || value === undefined) return undefined;
      return String(value);
    };

    const schedules: RoomAcademicScheduleItem[] = [];

    list.forEach((item, index) => {
      if (!item || typeof item !== "object") return;

      const record = item as UnknownRecord;
      const roomRecord =
        record.room && typeof record.room === "object"
          ? (record.room as UnknownRecord)
          : null;

      schedules.push({
        id: normalizeText(record.id) || `${roomId}-${index}`,
        roomId: normalizeText(record.roomId) || normalizeText(roomRecord?.id),
        startTime: normalizeText(record.startTime),
        endTime: normalizeText(record.endTime),
        daysOfWeek: normalizeText(record.daysOfWeek),
        fromDate: normalizeText(record.fromDate),
        toDate: normalizeText(record.toDate),
        description: normalizeText(record.description) ?? null,
      });
    });

    return schedules;
  },

  // start add updateLayout method
  async updateFloorLayout(
    floorId: string,
    items: {
      roomId?: string;
      id?: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
    decorations?: {
      type: string;
      label: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  ): Promise<void> {
    const payload = {
      items: items
        .map((item) => {
          const normalizedRoomId = String(item.roomId ?? item.id ?? "").trim();
          if (!normalizedRoomId) return null;

          return {
            roomId: normalizedRoomId,
            x: Number(item.x),
            y: Number(item.y),
            width: Number(item.width),
            height: Number(item.height),
          };
        })
        .filter(
          (
            item,
          ): item is {
            roomId: string;
            x: number;
            y: number;
            width: number;
            height: number;
          } => item !== null,
        ),
      decorations: decorations || [],
    };

    await api.put(
      buildUrl(API_ENDPOINTS.ROOMS.UPDATE_LAYOUT, { floorId }),
      payload,
    );
  },

  async getFloorDecorations(floorId: string): Promise<UnknownRecord[]> {
    const res = await api.get<unknown>(
      `/api/v1/rooms/floors/${floorId}/decorations`,
    );
    const raw =
      res.data && typeof res.data === "object"
        ? (res.data as UnknownRecord)
        : ({} as UnknownRecord);
    const data = raw.data;
    return Array.isArray(data) ? (data as UnknownRecord[]) : [];
  },
  // end add updateLayout method
};
