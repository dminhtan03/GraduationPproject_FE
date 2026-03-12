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
};
