import type { MapRoomStatus } from "../utils";

export type RoomDetail = {
  roomId?: string;
  locationCode?: string;
  status?: MapRoomStatus;
  capacity?: number | null;
  amenities?: { id: string; name: string }[] | null;
  images?: { id: string; imageUrl: string }[] | null;
  score?: number | null;
  currentUserId?: string | null;
  currentUserName?: string | null;
  checkInTime?: string | null;
};

export type BuildingLayoutVariant =
  | "gamma"
  | "alphaStyle"
  | "betaStyle"
  | "deltaStyle"
  | "epsilonStyle";

export type RawMapRoom = {
  roomId?: string;
  id?: string;
  roomID?: string;
  room_id?: string;
  locationCode?: string;
  roomName?: string;
  status?: string;
  score?: number | null;
};

export type RawMapFloor = {
  floorId: string;
  floorName: string;
  rooms?: RawMapRoom[];
};

export type RawMapBuilding = {
  buildingId: string;
  buildingName: string;
  floors?: RawMapFloor[];
};

export type FloorDecoration = {
  id?: string | number;
  type?: string;
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};
