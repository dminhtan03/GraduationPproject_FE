import { API_ENDPOINTS, buildUrl } from "../constants/endpoints";
import { api } from "./api";

export interface NotificationApiItem {
  id?: string;
  title?: string;
  content?: string;
  userId?: string;
  isRead?: boolean;
  read?: boolean;
  createdAt?: string;
  reservationId?: string;
  ReservationId?: string;
  reservationStatusAtNow?: string;
}

interface ApiEnvelope<T> {
  data?: T;
}

export const notificationService = {
  async getAll(page = 0, size = 30): Promise<NotificationApiItem[]> {
    const response = await api.get<ApiEnvelope<NotificationApiItem[]>>(
      API_ENDPOINTS.NOTIFICATIONS.LIST,
      {
        params: { page, size },
      },
    );

    const payload = response.data?.data;
    return Array.isArray(payload) ? payload : [];
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.put(
      buildUrl(API_ENDPOINTS.NOTIFICATIONS.MARK_AS_READ, { notificationId }),
    );
  },
};
