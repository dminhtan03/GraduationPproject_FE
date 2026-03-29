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

const toNotificationArray = (payload: unknown): NotificationApiItem[] => {
  if (Array.isArray(payload)) {
    return payload as NotificationApiItem[];
  }

  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;

    if (Array.isArray(source.data)) {
      return source.data as NotificationApiItem[];
    }

    const nestedData = source.data as Record<string, unknown> | undefined;
    if (nestedData && Array.isArray(nestedData.content)) {
      return nestedData.content as NotificationApiItem[];
    }

    if (Array.isArray(source.content)) {
      return source.content as NotificationApiItem[];
    }
  }

  return [];
};

export const notificationService = {
  async getAll(page = 0, size = 30): Promise<NotificationApiItem[]> {
    const response = await api.get<ApiEnvelope<unknown>>(
      API_ENDPOINTS.NOTIFICATIONS.LIST,
      {
        params: { page, size },
      },
    );

    return toNotificationArray(response.data?.data);
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.put(
      buildUrl(API_ENDPOINTS.NOTIFICATIONS.MARK_AS_READ, { notificationId }),
    );
  },
};
