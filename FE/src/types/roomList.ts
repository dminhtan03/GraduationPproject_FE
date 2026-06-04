export type RoomListStatus = "AVAILABLE" | "UNAVAILABLE" | "BROKEN" | "LEARNING";
export type FilterType = "all" | "available" | "unavailable" | "broken" | "learning";

export interface RoomListItem {
  id: string;
  roomName: string;
  building: string;
  floorInfo?: string;
  status: RoomListStatus;
  buildingId: string;
  floorId: string;
  roomImage?: string;
  amenities?: string[];
  capacity?: number;
}

export interface RawMapRoom {
  roomId?: string;
  id?: string;
  locationCode?: string;
  roomName?: string;
  status?: string;
  images?: Array<{ imageUrl?: string; url?: string; image?: string; path?: string }>;
  thumbnailUrl?: string;
  imageUrl?: string;
  image?: string;
  roomImage?: string;
  amenities?: any[];
  utilities?: any[];
  amenity?: string;
  capacity?: number;
  slot?: number;
}

export interface RawMapFloor {
  floorId: string;
  floorName?: string;
  rooms?: RawMapRoom[];
}

export interface RawMapBuilding {
  buildingId: string;
  buildingName?: string;
  floors?: RawMapFloor[];
}
