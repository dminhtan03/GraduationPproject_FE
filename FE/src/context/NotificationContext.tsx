import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  AppNotification,
  NotificationCategory,
  WebSocketMessage,
} from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  notificationService,
  type NotificationApiItem,
} from "../services/notificationService";
import { logError } from "../utils/errorHandlers";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const sortByCreatedAtDesc = (items: AppNotification[]) =>
  [...items].sort((a, b) => {
    const left = new Date(a.createdAt).getTime() || 0;
    const right = new Date(b.createdAt).getTime() || 0;
    return right - left;
  });

const inferCategory = (
  title: string,
  message: string,
): NotificationCategory => {
  const source = `${title} ${message}`.toLowerCase();

  if (
    source.includes("reservation") ||
    source.includes("booking") ||
    source.includes("check-in") ||
    source.includes("check in")
  ) {
    return "booking";
  }

  if (source.includes("ai")) {
    return "ai";
  }

  return "system";
};

const mapApiItemToNotification = (
  item: NotificationApiItem,
): AppNotification => {
  const reservationId =
    typeof item.reservationId === "string"
      ? item.reservationId
      : typeof item.ReservationId === "string"
        ? item.ReservationId
        : undefined;

  const title = String(item.title || "Notification");
  const message = String(item.content || "");
  const createdAt = String(item.createdAt || new Date().toISOString());

  return {
    id: String(item.id || reservationId || createId()),
    backendId: typeof item.id === "string" ? item.id : undefined,
    title,
    message,
    createdAt,
    category: inferCategory(title, message),
    read: Boolean(item.isRead ?? item.read ?? false),
    reservationId,
    reservationStatusAtNow:
      typeof item.reservationStatusAtNow === "string"
        ? item.reservationStatusAtNow
        : undefined,
  };
};

const mapMessageToNotification = (
  message: WebSocketMessage,
): AppNotification | null => {
  if (message.type !== "notification") {
    return null;
  }

  const raw = (message.data || {}) as Record<string, unknown>;

  const title = String(raw.title ?? raw.subject ?? "Notification");
  const body = String(
    raw.message ?? raw.content ?? raw.body ?? raw.description ?? "",
  );

  const reservationId =
    typeof raw.reservationId === "string"
      ? raw.reservationId
      : typeof raw.ReservationId === "string"
        ? raw.ReservationId
        : undefined;

  const id =
    typeof raw.id === "string" && raw.id.trim().length > 0
      ? raw.id
      : reservationId && reservationId.trim().length > 0
        ? `reservation-${reservationId}`
        : createId();

  const createdAtSource = raw.createdAt ?? raw.time ?? message.timestamp;
  const createdAt = String(createdAtSource || message.timestamp);

  const categorySource = raw.category;
  const category =
    typeof categorySource === "string" && categorySource.trim().length > 0
      ? (categorySource as NotificationCategory)
      : inferCategory(title, body);

  const progress =
    typeof raw.progress === "number" ? (raw.progress as number) : undefined;
  const statusText =
    typeof raw.statusText === "string"
      ? (raw.statusText as string)
      : typeof raw.status === "string"
        ? (raw.status as string)
        : undefined;

  return {
    id,
    backendId: typeof raw.id === "string" ? (raw.id as string) : undefined,
    title,
    message: body,
    createdAt,
    category,
    read: false,
    progress,
    statusText,
    reservationId,
    reservationStatusAtNow:
      typeof raw.reservationStatusAtNow === "string"
        ? (raw.reservationStatusAtNow as string)
        : undefined,
  };
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    let active = true;

    const loadInitialNotifications = async () => {
      try {
        const items = await notificationService.getAll(0, 50);
        if (!active) {
          return;
        }

        const mapped = sortByCreatedAtDesc(
          items.map((item) => mapApiItemToNotification(item)),
        );
        setNotifications(mapped);
      } catch (error) {
        logError(error, "Load Notifications");
      }
    };

    loadInitialNotifications().catch((error) =>
      logError(error, "Load Notifications"),
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    const mapped = mapMessageToNotification(lastMessage);
    if (!mapped) return;

    setNotifications((prev) => {
      const existingIndex = prev.findIndex((n) => n.id === mapped.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        const keepReadState = updated[existingIndex].read;
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...mapped,
          read: keepReadState,
        };
        return sortByCreatedAtDesc(updated);
      }

      return sortByCreatedAtDesc([mapped, ...prev]).slice(0, 50);
    });
  }, [lastMessage]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAllAsRead = useCallback(() => {
    const unreadIds = notifications
      .filter((n) => !n.read && typeof n.backendId === "string")
      .map((n) => n.backendId as string);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (unreadIds.length === 0) {
      return;
    }

    Promise.allSettled(
      unreadIds.map((id) => notificationService.markAsRead(id)),
    ).catch((error) => logError(error, "Mark All Notifications As Read"));
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    let backendId: string | undefined;

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== id) {
          return n;
        }

        backendId = n.backendId;
        return { ...n, read: true };
      }),
    );

    if (!backendId) {
      return;
    }

    notificationService
      .markAsRead(backendId)
      .catch((error) => logError(error, "Mark Notification As Read"));
  }, []);

  const value: NotificationContextValue = useMemo(
    () => ({ notifications, unreadCount, markAllAsRead, markAsRead }),
    [notifications, unreadCount, markAllAsRead, markAsRead],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return ctx;
};
