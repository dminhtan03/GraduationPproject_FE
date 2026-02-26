import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import type { ApiError, CreateReservationRequest, Reservation } from "../types";

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

  return {
    id: String(item?.id ?? item?.reservationId ?? `${Date.now()}-${Math.random()}`),
    roomName:
      item?.roomName ??
      roomRef?.roomName ??
      roomRef?.locationCode ??
      roomRef?.name ??
      "Unknown room",
    building:
      item?.building ??
      roomRef?.building ??
      roomRef?.buildingName ??
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

  async getMyBookings(): Promise<Reservation[]> {
    try {
      const response = await api.get<any>(API_ENDPOINTS.ROOMS.MY_BOOKINGS);
      return toArray(response.data).map(normalizeReservation);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status !== 404) {
        throw error;
      }

      const fallbackResponse = await api.get<any>(API_ENDPOINTS.ROOMS.BOOK);
      return toArray(fallbackResponse.data).map(normalizeReservation);
    }
  },
};
