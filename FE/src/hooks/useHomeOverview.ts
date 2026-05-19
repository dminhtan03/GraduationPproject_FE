import { useCallback, useEffect, useMemo, useState } from "react";
import { roomService } from "../services/roomService";
import { normalizeRoomsMap } from "../utils/roomList";
import { extractApiMessage } from "../utils/errorHandlers";
import type { RoomListItem, RoomListStatus } from "../types/roomList";

type HomeStats = {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
};

const FEATURED_ROOM_LIMIT = 3;

const getStatusPriority = (status: RoomListStatus) => {
  if (status === "AVAILABLE") return 0;
  if (status === "LEARNING") return 1;
  if (status === "UNAVAILABLE") return 2;
  return 3;
};

const pickFeaturedRooms = (rooms: RoomListItem[]): RoomListItem[] => {
  const sorted = [...rooms].sort(
    (a, b) => getStatusPriority(a.status) - getStatusPriority(b.status),
  );
  const withImages = sorted.filter((room) => room.roomImage);
  const withoutImages = sorted.filter((room) => !room.roomImage);
  return [...withImages, ...withoutImages].slice(0, FEATURED_ROOM_LIMIT);
};

const buildHomeStats = (rooms: RoomListItem[]): HomeStats => {
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter(
    (room) => room.status === "AVAILABLE",
  ).length;
  const brokenRooms = rooms.filter((room) => room.status === "BROKEN").length;
  const activeRooms = Math.max(0, totalRooms - brokenRooms);
  const occupiedRooms = Math.max(0, activeRooms - availableRooms);
  const occupancyRate =
    activeRooms > 0 ? Math.round((occupiedRooms / activeRooms) * 100) : 0;

  return {
    totalRooms,
    availableRooms,
    occupiedRooms,
    occupancyRate,
  };
};

export const useHomeOverview = () => {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const mapData = await roomService.getRoomsMap();
      setRooms(normalizeRoomsMap(mapData));
    } catch (err) {
      setError(extractApiMessage(err, "Unable to load room data"));
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

    void loadRooms(hasCached);
  }, [loadRooms]);

  const featuredRooms = useMemo(() => pickFeaturedRooms(rooms), [rooms]);
  const stats = useMemo(() => buildHomeStats(rooms), [rooms]);

  return {
    loading,
    error,
    featuredRooms,
    stats,
  };
};

export type { HomeStats };
