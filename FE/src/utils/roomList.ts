import {
  type RoomsMapResponse,
  toAbsoluteImageUrl,
} from "../services/roomService";
import type {
  RoomListItem,
  RoomListStatus,
  RawMapRoom,
} from "../types/roomList";

const normalizeRoomStatus = (status: unknown): RoomListStatus => {
  const rawStatus = String(status || "").toUpperCase();

  if (
    rawStatus === "BROKEN" ||
    rawStatus === "UNAVAILABLE" ||
    rawStatus === "LEARNING"
  ) {
    return rawStatus;
  }

  return "AVAILABLE";
};

const resolveText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  return value.length > 0 ? value : undefined;
};

const resolveAmenityLabel = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return resolveText(value);
  }

  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  return (
    resolveText(record.name) ??
    resolveText(record.amenityName) ??
    resolveText(record.utilityName)
  );
};

const resolveRoomImage = (room: RawMapRoom): string => {
  let rawUrl = "";

  if (Array.isArray(room.images) && room.images.length > 0) {
    const firstImage = room.images[0];
    if (firstImage && typeof firstImage === "object") {
      const imageRecord = firstImage as Record<string, unknown>;
      rawUrl =
        resolveText(imageRecord.imageUrl) ??
        resolveText(imageRecord.url) ??
        resolveText(imageRecord.image) ??
        resolveText(imageRecord.path) ??
        "";
    }
  }

  if (!rawUrl) {
    rawUrl =
      resolveText(room.thumbnailUrl) ??
      resolveText(room.imageUrl) ??
      resolveText(room.image) ??
      resolveText(room.roomImage) ??
      "";
  }

  return toAbsoluteImageUrl(rawUrl) ?? rawUrl;
};

const resolveAmenities = (room: RawMapRoom): string[] => {
  if (Array.isArray(room.amenities)) {
    return (room.amenities as unknown[])
      .map(resolveAmenityLabel)
      .filter((amenity): amenity is string => Boolean(amenity));
  }

  if (Array.isArray(room.utilities)) {
    return (room.utilities as unknown[])
      .map(resolveAmenityLabel)
      .filter((amenity): amenity is string => Boolean(amenity));
  }

  const amenity = resolveText(room.amenity);
  return amenity ? [amenity] : [];
};

const resolveRoomId = (room: RawMapRoom): string => {
  return resolveText(room.roomId) ?? resolveText(room.id) ?? "";
};

const getRoomPairKey = (buildingId: string, floorId: string) =>
  `${buildingId}|${floorId}`;

export const normalizeRoomsMap = (
  mapData: RoomsMapResponse | null | undefined,
): RoomListItem[] => {
  const buildings = Array.isArray(mapData?.buildingResponse)
    ? mapData.buildingResponse
    : [];

  const flattened: RoomListItem[] = [];

  buildings.forEach((building) => {
    const floors = Array.isArray(building.floors) ? building.floors : [];

    floors.forEach((floor) => {
      const floorRooms = Array.isArray(floor.rooms) ? floor.rooms : [];

      floorRooms.forEach((room) => {
        const rawRoom = room as RawMapRoom;
        const roomId = resolveRoomId(rawRoom);

        if (!roomId) return;

        flattened.push({
          id: roomId,
          roomName:
            resolveText(rawRoom.locationCode) ??
            resolveText(rawRoom.roomName) ??
            "",
          building: resolveText(building.buildingName) ?? "",
          floorInfo: resolveText(floor.floorName) ?? "",
          status: normalizeRoomStatus(rawRoom.status),
          buildingId: building.buildingId,
          floorId: floor.floorId,
          roomImage: resolveRoomImage(rawRoom),
          amenities: resolveAmenities(rawRoom),
          capacity: rawRoom.capacity || rawRoom.slot || 0,
        });
      });
    });
  });

  return flattened;
};

export const buildTimeStatusOverrides = (
  rooms: RoomListItem[],
  floorAvailability: Map<string, Map<string, RoomListStatus>>,
): Record<string, RoomListStatus> => {
  const overrides: Record<string, RoomListStatus> = {};

  rooms.forEach((room) => {
    if (room.status === "BROKEN") {
      overrides[room.id] = "BROKEN";
      return;
    }

    const roomStatus = floorAvailability
      .get(getRoomPairKey(room.buildingId, room.floorId))
      ?.get(room.id);

    overrides[room.id] = roomStatus ?? "UNAVAILABLE";
  });

  return overrides;
};
