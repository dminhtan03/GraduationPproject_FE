export type Amenity = { id: string; name: string };

export type RoomNode = {
  amenities?: Amenity[];
  locationCode?: string | null;
  roomCode?: string | null;
  roomName?: string | null;
  code?: string | null;
};

export type ServiceLine = {
  id: string;
  serviceItemId: string;
  name: string;
  unit?: string | null;
  priceSnapshot?: number | null;
  quantity: number;
  note?: string | null;
  status?: string | null;
};

export type ReservationNode = {
  serviceItems?: ServiceLine[];
  room?: RoomNode | null;
  startTime?: string | null;
  endTime?: string | null;
};

export type ReservationDetail = {
  serviceItems?: ServiceLine[];
  reservation?: ReservationNode | null;
  room?: RoomNode | null;
  startTime?: string | null;
  endTime?: string | null;
} & Record<string, unknown>;

export type EventData = {
  title?: string | null;
  visibility?: string | null;
  description?: string | null;
} & Record<string, unknown>;

export type ServiceStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED";

export type SummaryRow = {
  name: string;
  unit: string | null;
  priceSnapshot: number | null;
  totalQty: number;
  activeQty: number;
  doneQty: number;
  cancelledQty: number;
  estimatedTotal: number | null;
};
