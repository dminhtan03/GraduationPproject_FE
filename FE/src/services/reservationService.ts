import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import type {
  ApiError,
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
  const resolvedStatus =
    item?.status ??
    item?.reservationStatus ??
    item?.bookingStatus ??
    item?.state ??
    item?.statusName ??
    (Array.isArray(item?.statuses) ? item.statuses[0] : undefined);

  const rawFeedbackSubmitted =
    item?.feedbackSubmitted ??
    item?.isFeedbackSubmitted ??
    item?.hasFeedback ??
    item?.hasSubmittedFeedback ??
    item?.rated ??
    item?.isRated;

  const feedbackIdValue =
    item?.feedbackId ?? item?.feedback?.id ?? item?.feedback?.feedbackId;

  return {
    id:
      item?.id != null
        ? String(item.id)
        : item?.reservationId != null
          ? String(item.reservationId)
          : undefined,
    locationCode:
      item?.locationCode ??
      item?.roomLocationCode ??
      item?.roomCode ??
      item?.roomName ??
      undefined,
    floor:
      item?.floor ??
      item?.floorName ??
      item?.floorInfo ??
      item?.roomFloor ??
      undefined,
    address:
      item?.address ??
      item?.buildingAddress ??
      item?.buildingName ??
      undefined,
    purpose: item?.purpose ?? item?.bookingPurpose ?? item?.title ?? undefined,
    note: item?.note ?? item?.description ?? item?.message ?? undefined,
    startTime: item?.startTime ?? item?.startDateTime ?? item?.fromTime ?? undefined,
    endTime: item?.endTime ?? item?.endDateTime ?? item?.toTime ?? undefined,
    status: resolvedStatus != null ? String(resolvedStatus) : undefined,
    feedbackId:
      feedbackIdValue != null && String(feedbackIdValue).trim()
        ? String(feedbackIdValue)
        : undefined,
    feedbackSubmitted:
      typeof rawFeedbackSubmitted === "boolean"
        ? rawFeedbackSubmitted
        : feedbackIdValue != null,
  };
};

const shouldTryFallback = (error: unknown): boolean => {
  const apiError = error as ApiError;
  return apiError?.status === 404 || apiError?.status === 405;
};

const putWithFallback = async (
  primaryUrl: string,
  fallbackUrls: string[],
  payload?: Record<string, any>,
) => {
  try {
    return await api.put(primaryUrl, payload);
  } catch (error) {
    if (!shouldTryFallback(error)) {
      throw error;
    }

    let lastError = error;
    for (const fallbackUrl of fallbackUrls) {
      try {
        return await api.put(fallbackUrl, payload);
      } catch (fallbackError) {
        lastError = fallbackError;
        if (!shouldTryFallback(fallbackError)) {
          throw fallbackError;
        }
      }
    }

    throw lastError;
  }
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

    const paramsSerializer = (params: Record<string, any>) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value == null || value === "") return;
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item != null && item !== "") {
              searchParams.append(key, String(item));
            }
          });
          return;
        }
        searchParams.append(key, String(value));
      });
      return searchParams.toString();
    };

    const requestConfig = {
      params: {
        page: requestedPage,
        size: requestedSize,
        locationCode: query.locationCode,
        address: query.address,
        statuses: query.statuses,
        buildingId: query.buildingId,
        startTime: query.startTime,
        endTime: query.endTime,
      },
      paramsSerializer,
    };

    let response;
    try {
      response = await api.get<any>(API_ENDPOINTS.ROOMS.MY_STATUS, requestConfig);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status !== 404 && apiError.status !== 405) {
        throw error;
      }
      response = await api.get<any>(API_ENDPOINTS.ROOMS.BOOK, requestConfig);
    }

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

  async checkInBooking(reservationId: string) {
    const normalizedId = String(reservationId);
    const checkInUrl = API_ENDPOINTS.ROOMS.CHECK_IN.replace(":id", normalizedId);

    return putWithFallback(
      checkInUrl,
      [
        `${API_ENDPOINTS.ROOMS.BOOK}/check-in/${normalizedId}`,
        `${API_ENDPOINTS.ROOMS.BOOK}/${normalizedId}/check-in`,
      ],
      { reservationId: normalizedId },
    );
  },

  async returnRoomBooking(reservationId: string) {
    const normalizedId = String(reservationId);
    const returnRoomUrl = API_ENDPOINTS.ROOMS.RETURN_ROOM.replace(":id", normalizedId);

    return putWithFallback(
      returnRoomUrl,
      [
        `${API_ENDPOINTS.ROOMS.BOOK}/return-room/${normalizedId}`,
        `${API_ENDPOINTS.ROOMS.BOOK}/${normalizedId}/return-room`,
      ],
      { reservationId: normalizedId },
    );
  },

  async extendRoomBooking(reservationId: string, hour: number) {
    const normalizedId = String(reservationId);
    const extendUrl = API_ENDPOINTS.ROOMS.EXTEND_ROOM.replace(":id", normalizedId);

    try {
      return await api.put(extendUrl, undefined, { params: { hour } });
    } catch (error) {
      if (!shouldTryFallback(error)) {
        throw error;
      }

      return api.put(`${API_ENDPOINTS.ROOMS.BOOK}/extend/${normalizedId}`, undefined, {
        params: { hour },
      });
    }
  },

  async cancelBooking(reservationId: string) {
    const normalizedId = String(reservationId);
    const cancelUrl = API_ENDPOINTS.ROOMS.CANCEL_BOOKING.replace(":id", normalizedId);

    return putWithFallback(
      cancelUrl,
      [
        `${API_ENDPOINTS.ROOMS.BOOK}/cancel/${normalizedId}`,
        `${API_ENDPOINTS.ROOMS.BOOK}/${normalizedId}/cancel`,
      ],
      { reservationId: normalizedId },
    );
  },
};
