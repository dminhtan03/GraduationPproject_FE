import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import type {
  CreateReservationRequest,
  Reservation,
  ReservationPageResult,
  ReservationStatusQuery,
} from "../types";

const toArray = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.data?.reservations)) return payload.data.reservations;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.reservations)) return payload.reservations;
  return [];
};

const normalizeReservation = (item: any): Reservation => {
  const roomRef = item?.room ?? item?.roomResponse ?? {};
  const buildingRef =
    item?.buildingResponse ?? item?.buildingInfo ?? roomRef?.buildingResponse ?? {};

  return {
    id: String(
      item?.id ??
        item?.reservationId ??
        item?.reservationCode ??
        item?.code ??
        `${item?.startTime ?? ""}-${item?.endTime ?? ""}`,
    ),
    roomName:
      item?.locationCode ??
      item?.roomCode ??
      item?.roomLocationCode ??
      item?.roomName ??
      roomRef?.roomName ??
      roomRef?.locationCode ??
      roomRef?.roomCode ??
      roomRef?.name ??
      "Unknown room",
    building:
      item?.address ??
      item?.buildingAddress ??
      item?.buildingName ??
      item?.building ??
      roomRef?.building ??
      roomRef?.address ??
      roomRef?.buildingName ??
      buildingRef?.address ??
      buildingRef?.buildingName ??
      "Unknown building",
    purpose: item?.purpose ?? item?.reason ?? item?.title ?? "-",
    startTime: item?.startTime ?? item?.startDateTime ?? item?.fromTime ?? "",
    endTime: item?.endTime ?? item?.endDateTime ?? item?.toTime ?? "",
    status: (item?.status ?? item?.bookingStatus ?? item?.state ?? "PENDING").toString(),
    attendeeCount: item?.attendeeCount ?? item?.participants,
    note: item?.note,
    createdAt: item?.createdAt ?? item?.createdDate,
  };
};

export const reservationService = {
  async createReservation(payload: CreateReservationRequest) {
    return api.post(API_ENDPOINTS.ROOMS.BOOK, {
      roomId: payload.roomId,
      purpose: payload.purpose,
      startTime: payload.startTime,
      endTime: payload.endTime,
      attendeeCount: payload.attendeeCount,
      note: payload.note,
    });
  },

  async getMyBookings(
    query: ReservationStatusQuery = {},
  ): Promise<ReservationPageResult> {
    const requestedPage = query.page ?? 0;
    const requestedSize = query.size ?? 5;

    const response = await api.get<any>(API_ENDPOINTS.ROOMS.MY_STATUS, {
      params: {
        page: requestedPage,
        size: requestedSize,
        locationCode: query.locationCode,
        address: query.address,
        statuses: query.statuses?.length ? query.statuses.join(",") : undefined,
        buildingId: query.buildingId,
        startTime: query.startTime,
        endTime: query.endTime,
      },
    });

    const payload = response.data || {};
    const source = payload?.data ?? payload;
    const items = toArray(payload).map(normalizeReservation);

    const total =
      payload?.meta?.total ??
      source?.totalElements ??
      source?.total ??
      source?.page?.totalElements ??
      items.length;

    const page =
      source?.number ??
      source?.pageNumber ??
      source?.page ??
      source?.pageable?.pageNumber ??
      requestedPage;

    const size =
      source?.size ??
      source?.pageSize ??
      source?.pageable?.pageSize ??
      requestedSize;

    return {
      items,
      total: Number(total) || 0,
      page: Number(page) || 0,
      size: Number(size) || requestedSize,
    };
  },
};
