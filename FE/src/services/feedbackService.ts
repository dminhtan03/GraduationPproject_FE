import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";

export interface CreateFeedbackRequest {
  reservationId: string;
  rating: number;
  description: string;
  createdAt?: string;
}

export interface RoomFeedbackItem {
  id: string;
  rating: number;
  description: string;
  userName: string;
}

export interface RoomFeedbackResult {
  items: RoomFeedbackItem[];
  total: number;
}

export const feedbackService = {
  async createFeedback(payload: CreateFeedbackRequest) {
    return api.post(API_ENDPOINTS.FEEDBACK.CREATE, payload);
  },

  async getRoomFeedbacks(
    roomId: string,
    page = 0,
    size = 10,
  ): Promise<RoomFeedbackResult> {
    const res = await api.get<any>(API_ENDPOINTS.FEEDBACK.LIST, {
      params: { roomId, page, size },
    });

    const payload = res.data || {};
    const wrappedData = payload.data;
    const list = Array.isArray(wrappedData)
      ? wrappedData
      : Array.isArray(wrappedData?.content)
        ? wrappedData.content
        : Array.isArray(payload.content)
          ? payload.content
          : [];

    return {
      items: list.map((item: any) => ({
        id: String(item.id || ""),
        rating:
          typeof item.rating === "number" && !Number.isNaN(item.rating)
            ? item.rating
            : 0,
        description: String(item.description || ""),
        userName: String(item.userName || "Anonymous user"),
      })),
      total:
        typeof payload.meta?.total === "number"
          ? payload.meta.total
          : typeof wrappedData?.totalElements === "number"
            ? wrappedData.totalElements
            : typeof payload.totalElements === "number"
              ? payload.totalElements
              : list.length,
    };
  },

  async getFeedbackDescriptionByReservation(
    reservationId: string,
  ): Promise<string | null> {
    const normalizedReservationId = String(reservationId || "").trim();
    if (!normalizedReservationId) {
      return null;
    }

    const extractDescription = (responseData: any): string | null => {
      const payload = responseData || {};
      const wrappedData = payload.data;
      const list = Array.isArray(wrappedData)
        ? wrappedData
        : Array.isArray(wrappedData?.content)
          ? wrappedData.content
          : Array.isArray(payload.content)
            ? payload.content
            : [];

      const matchByReservationId = list.find((item: any) => {
        const itemReservationId =
          item?.reservationId ??
          item?.reservationID ??
          item?.reservation?.id ??
          item?.bookingId ??
          item?.bookingID ??
          item?.id;

        return String(itemReservationId || "").trim() === normalizedReservationId;
      });

      const candidate = matchByReservationId || list[0];
      const description = String(candidate?.description || "").trim();
      return description || null;
    };

    const queryVariants = [
      { reservationId: normalizedReservationId, page: 0, size: 20 },
      { reservationID: normalizedReservationId, page: 0, size: 20 },
      { bookingId: normalizedReservationId, page: 0, size: 20 },
      { id: normalizedReservationId, page: 0, size: 20 },
    ];

    for (const params of queryVariants) {
      try {
        const res = await api.get<any>(API_ENDPOINTS.FEEDBACK.LIST, { params });
        const description = extractDescription(res.data);
        if (description) {
          return description;
        }
      } catch {
        // Try next variant.
      }
    }

    return null;
  },
};
