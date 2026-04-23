import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import { buildUrl } from "../constants/endpoints";
import { API_CONFIG } from "../constants";
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
    roomId:
      item?.roomId != null
        ? String(item.roomId)
        : item?.seatId != null
          ? String(item.seatId)
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
    buildingName:
      item?.buildingName ??
      item?.building ??
      item?.address ??
      item?.buildingAddress ??
      undefined,
    purpose: item?.purpose ?? item?.bookingPurpose ?? item?.title ?? undefined,
    note: item?.note ?? item?.description ?? item?.message ?? undefined,
    startTime: item?.startTime ?? item?.startDateTime ?? item?.fromTime ?? undefined,
    endTime: item?.endTime ?? item?.endDateTime ?? item?.toTime ?? undefined,
    attendeeCount:
      typeof item?.attendeeCount === "number"
        ? item.attendeeCount
        : typeof item?.participantCount === "number"
          ? item.participantCount
          : undefined,
    status: resolvedStatus != null ? String(resolvedStatus) : undefined,
    feedbackId:
      feedbackIdValue != null && String(feedbackIdValue).trim()
        ? String(feedbackIdValue)
        : undefined,
    feedbackSubmitted:
      typeof rawFeedbackSubmitted === "boolean"
        ? rawFeedbackSubmitted
        : feedbackIdValue != null,
    rawData: item && typeof item === "object" ? (item as Record<string, unknown>) : undefined,
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
    if (
      payload.attendeeCount != null &&
      (!Number.isFinite(payload.attendeeCount) || payload.attendeeCount <= 0)
    ) {
      throw {
        message: "Attendee count must be greater than 0.",
        status: 400,
      };
    }

    return api.post(API_ENDPOINTS.ROOMS.BOOK, {
      roomId: payload.roomId,
      purpose: payload.purpose,
      startTime: payload.startTime,
      endTime: payload.endTime,
      attendeeCount: payload.attendeeCount,
      note: payload.note,
      // start+ chức năng đặt thêm dịch vụ đi kèm khi đặt phòng
      serviceItems: payload.serviceItems,
      // end+ chức năng đặt thêm dịch vụ đi kèm khi đặt phòng
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

  async getBookingDetail(reservationId: string): Promise<Record<string, unknown>> {
    const normalizedId = String(reservationId);
    if (!normalizedId) {
      throw { message: "Missing reservation id", status: 400 };
    }

    const normalizeDetailPayload = (
      payload: any,
    ): Record<string, unknown> | null => {
      const source = payload?.data ?? payload;

      if (source && typeof source === "object") {
        const reservationNode =
          source.reservation && typeof source.reservation === "object"
            ? (source.reservation as Record<string, unknown>)
            : null;

        if (reservationNode) {
          return {
            ...(source as Record<string, unknown>),
            ...reservationNode,
            reservation: reservationNode,
            feedback:
              source.feedback && typeof source.feedback === "object"
                ? source.feedback
                : reservationNode.feedback,
            roomImages: Array.isArray(source.roomImages)
              ? source.roomImages
              : reservationNode.roomImages,
            history: Array.isArray(source.history) ? source.history : [],
          };
        }

        if (source.id != null || source.reservationId != null) {
          return source as Record<string, unknown>;
        }
      }

      return null;
    };

    // Try PUT endpoint first (correct endpoint)
    try {
      const endpoint = buildUrl(API_ENDPOINTS.ROOMS.DETAIL_RESERVATION, {
        id: normalizedId,
      });
      const response = await api.put<any>(endpoint);
      const normalizedDetail = normalizeDetailPayload(response.data || {});
      if (normalizedDetail) {
        return normalizedDetail;
      }
    } catch (error) {
      // Fall through to other endpoints if this fails
    }

    const directDetailRequests: Array<{
      endpoint: string;
      params?: Record<string, string | number>;
    }> = [
      { endpoint: `${API_ENDPOINTS.ROOMS.BOOK}/${normalizedId}` },
      { endpoint: `${API_ENDPOINTS.ROOMS.BOOK}/detail/${normalizedId}` },
      { endpoint: `${API_ENDPOINTS.ROOMS.MY_STATUS}/${normalizedId}` },
      {
        endpoint: API_ENDPOINTS.ROOMS.BOOK,
        params: { reservationId: normalizedId, page: 0, size: 1 },
      },
      {
        endpoint: API_ENDPOINTS.ROOMS.BOOK,
        params: { reservationID: normalizedId, page: 0, size: 1 },
      },
      {
        endpoint: API_ENDPOINTS.ROOMS.MY_STATUS,
        params: { reservationId: normalizedId, page: 0, size: 1 },
      },
      {
        endpoint: API_ENDPOINTS.ROOMS.MY_STATUS,
        params: { reservationID: normalizedId, page: 0, size: 1 },
      },
    ];

    let directDetailError: unknown;
    for (const request of directDetailRequests) {
      try {
        const response = await api.get<any>(request.endpoint, {
          params: request.params,
        });
        const normalizedDetail = normalizeDetailPayload(response.data || {});
        if (normalizedDetail) {
          const detailIdCandidates = [
            normalizedDetail.id,
            normalizedDetail.reservationId,
            normalizedDetail.reservationID,
            normalizedDetail.bookingId,
            normalizedDetail.bookingID,
            (normalizedDetail.reservation as Record<string, unknown> | undefined)?.id,
          ]
            .map((value) => (value != null ? String(value) : ""))
            .filter(Boolean);

          if (detailIdCandidates.length === 0 || detailIdCandidates.includes(normalizedId)) {
            return normalizedDetail;
          }
        }
      } catch (error) {
        directDetailError = error;
      }
    }

    const endpointCandidates = [API_ENDPOINTS.ROOMS.MY_STATUS, API_ENDPOINTS.ROOMS.BOOK];

    let lastError: unknown;
    for (const endpoint of endpointCandidates) {
      try {
        const response = await api.get<any>(endpoint, {
          params: {
            page: 0,
            size: 100,
            reservationId: normalizedId,
          },
        });

        const payload = response.data || {};
        const normalizedDetail = normalizeDetailPayload(payload);
        if (normalizedDetail) {
          const normalizedIdFromDetail =
            normalizedDetail.id != null
              ? String(normalizedDetail.id)
              : normalizedDetail.reservationId != null
                ? String(normalizedDetail.reservationId)
                : normalizedDetail.bookingId != null
                  ? String(normalizedDetail.bookingId)
                  : "";

          if (normalizedIdFromDetail === normalizedId) {
            return normalizedDetail;
          }
        }

        const items = toArray(payload);
        const found = items.find((item) => {
          const itemIdCandidates = [
            item?.id,
            item?.reservationId,
            item?.reservationID,
            item?.bookingId,
            item?.bookingID,
            item?.reservation?.id,
          ]
            .map((value) => (value != null ? String(value) : ""))
            .filter(Boolean);

          return itemIdCandidates.includes(normalizedId);
        });

        if (found && typeof found === "object") {
          return found as Record<string, unknown>;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw (
      lastError ||
      directDetailError || {
        message: "Unable to load booking detail",
        status: 404,
      }
    );
  },

  async getRoomImagesByRoomId(roomId: string): Promise<string[]> {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId) return [];

    const endpoint = buildUrl(API_ENDPOINTS.ROOMS.ROOM_IMAGES_BY_ROOM, {
      roomId: normalizedRoomId,
    });

    const response = await api.get<any>(endpoint);
    const payload = response.data || {};
    const source = payload?.data ?? payload;

    const rawItems = toArray(source);
    const items =
      rawItems.length > 0
        ? rawItems
        : source && typeof source === "object"
          ? [source]
          : [];

    const toAbsoluteUrl = (value: string): string => {
      if (!value) return "";
      if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) {
        return value;
      }
      if (value.startsWith("/")) {
        const base = String(API_CONFIG.BASE_URL || "").replace(/\/$/, "");
        return `${base}${value}`;
      }
      return value;
    };

    const urls = new Set<string>();
    const visited = new Set<unknown>();

    const tryAdd = (value: unknown) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if (!trimmed) return;

      const lower = trimmed.toLowerCase();
      const looksLikeImageRef =
        /^https?:\/\//i.test(trimmed) ||
        trimmed.startsWith("/") ||
        /^data:image\//i.test(trimmed) ||
        lower.includes("cloud") ||
        lower.includes("image") ||
        /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(trimmed);

      if (looksLikeImageRef) {
        urls.add(toAbsoluteUrl(trimmed));
      }
    };

    const walk = (node: unknown) => {
      if (node == null || visited.has(node)) return;
      visited.add(node);

      if (typeof node === "string") {
        tryAdd(node);
        return;
      }

      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }

      if (typeof node !== "object") return;

      const objectNode = node as Record<string, unknown>;
      const preferredKeys = [
        "imageUrl",
        "url",
        "fileUrl",
        "publicUrl",
        "imagePath",
        "path",
        "secureUrl",
        "thumbnailUrl",
      ];

      preferredKeys.forEach((key) => {
        tryAdd(objectNode[key]);
      });

      Object.values(objectNode).forEach(walk);
    };

    items.forEach(walk);

    return [...urls];
  },

  async cancelBooking(reservationId: string, reason?: string) {
    const normalizedId = String(reservationId);
    const cancelUrl = API_ENDPOINTS.ROOMS.CANCEL_BOOKING.replace(":id", normalizedId);
    const payload = {
      reservationId: normalizedId,
      cancelReason: reason?.trim() || undefined,
      reason: reason?.trim() || undefined,
    };

    return putWithFallback(
      cancelUrl,
      [
        `${API_ENDPOINTS.ROOMS.BOOK}/cancel/${normalizedId}`,
        `${API_ENDPOINTS.ROOMS.BOOK}/${normalizedId}/cancel`,
      ],
      payload,
    );
  },
};
