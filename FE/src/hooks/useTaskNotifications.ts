import { useEffect, useRef, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:8080";

export interface TaskNotification {
  title: string;
  content: string;
  userId: string;
  createdAt?: string;
}

export const useTaskNotifications = (
  userId: string | null | undefined,
  onNotification: (n: TaskNotification) => void,
) => {
  const clientRef = useRef<Client | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    if (!userId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${WS_URL}/websocket`),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/notifications/${userId}`, (msg) => {
          try {
            const data = JSON.parse(msg.body) as TaskNotification;
            onNotificationRef.current(data);
          } catch { /* ignore malformed */ }
        });
      },
      onStompError: () => { /* silent reconnect */ },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [userId]);
};
