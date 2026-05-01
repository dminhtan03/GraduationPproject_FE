export type RecurringSeries = {
  id: string;
  roomId: string;
  roomCode: string;
  startTimeOfDay: string;
  endTimeOfDay: string;
  daysOfWeek: string;
  purpose: string;
  note?: string | null;
  fromDate: string;
  untilDate?: string | null;
  rollingWindowWeeks?: number | null;
  status: string;
  lastSyncUntil?: string | null;
  createdAt?: string | null;
};

export type RoomOption = {
  id: string;
  locationCode: string;
  roomName: string;
};
