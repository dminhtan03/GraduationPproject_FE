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

const mapMessageToNotification = (
  message: WebSocketMessage,
): AppNotification | null => {
  if (message.type !== "notification") {
    return null;
  }

  const raw = (message.data || {}) as Record<string, unknown>;

  const id =
    typeof raw.id === "string" && raw.id.trim().length > 0
      ? raw.id
      : createId();

  const titleSource = raw.title ?? raw.subject ?? "Notification";
  const messageSource = raw.message ?? raw.body ?? raw.description ?? "";
  const createdAtSource = raw.createdAt ?? raw.time ?? message.timestamp;
  const categorySource = raw.category ?? raw.type ?? "system";

  const title = String(titleSource);
  const body = String(messageSource);
  const createdAt = String(createdAtSource || message.timestamp);

  const category = String(categorySource || "system") as NotificationCategory;
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
    title,
    message: body,
    createdAt,
    category,
    read: false,
    progress,
    statusText,
  };
};

const createInitialNotifications = (): AppNotification[] => {
  const now = new Date();
  const minutesAgo = (m: number) => {
    const d = new Date(now.getTime() - m * 60 * 1000);
    return d.toISOString();
  };

  return [
    {
      id: createId(),
      title: "Batch Service Active",
      message: "Processing rooms in Building Epsilon...",
      createdAt: minutesAgo(0),
      category: "batch",
      read: false,
      progress: 53,
      statusText: "In progress",
    },
    {
      id: createId(),
      title: "New Message from AI Assistant",
      message:
        "Based on your booking history, a room is available for your upcoming study group.",
      createdAt: minutesAgo(2),
      category: "ai",
      read: false,
    },
    {
      id: createId(),
      title: "Booking Confirmation",
      message: "Your booking has been confirmed.",
      createdAt: minutesAgo(60),
      category: "booking",
      read: false,
    },
  ];
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(
    createInitialNotifications,
  );

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (!lastMessage) return;

    const mapped = mapMessageToNotification(lastMessage);
    if (!mapped) return;

    setNotifications((prev) => {
      const existingIndex = prev.findIndex((n) => n.id === mapped.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...mapped };
        return updated;
      }
      return [mapped, ...prev].slice(0, 30);
    });
  }, [lastMessage]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
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
