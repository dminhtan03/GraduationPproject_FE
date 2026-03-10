// ===== CUSTOM HOOK CHO WEBSOCKET =====

import { useState, useEffect, useRef, useCallback } from "react";
import { Client, type Frame, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WebSocketMessage } from "../types";
import { API_CONFIG } from "../constants";
import { API_ENDPOINTS } from "../constants/endpoints";
import { logError } from "../utils/errorHandlers";
import { api } from "../services/api";

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
}

type ProfileResponse = {
  id?: string;
};

const normalizeSockJsUrl = (rawUrl?: string) => {
  const fallback = "http://localhost:8080/websocket";
  const input = (rawUrl || API_CONFIG.WEBSOCKET_URL || fallback).trim();

  try {
    if (/^wss?:\/\//i.test(input)) {
      const normalized = input.replace(/^ws/i, "http");
      const url = new URL(normalized);
      if (!url.pathname || url.pathname === "/") {
        url.pathname = "/websocket";
      }
      return url.toString();
    }

    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      if (!url.pathname || url.pathname === "/") {
        url.pathname = "/websocket";
      }
      return url.toString();
    }

    return fallback;
  } catch {
    return fallback;
  }
};

const mapPayloadToWebSocketMessage = (payload: unknown): WebSocketMessage => {
  if (payload && typeof payload === "object") {
    const raw = payload as Record<string, unknown>;
    const hasNotificationFields =
      typeof raw.title === "string" ||
      typeof raw.content === "string" ||
      typeof raw.userId === "string";

    if (hasNotificationFields) {
      return {
        type: "notification",
        data: {
          id: raw.id,
          title: raw.title || "Notification",
          message: raw.content || raw.message || "",
          createdAt: raw.createdAt || new Date().toISOString(),
          category: raw.type || "system",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  return {
    type: "update",
    data: payload,
    timestamp: new Date().toISOString(),
  };
};

export const useWebSocket = (url?: string) => {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
  });

  const clientRef = useRef<Client | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isUnmountedRef = useRef(false);

  const websocketUrl = normalizeSockJsUrl(url);

  const disconnect = useCallback(() => {
    const currentClient = clientRef.current;
    clientRef.current = null;

    if (currentClient) {
      currentClient.deactivate();
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
  }, []);

  const connect = useCallback(async () => {
    if (clientRef.current?.active) {
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const profileRes = await api.get<
        ProfileResponse | { data: ProfileResponse }
      >(API_ENDPOINTS.AUTH.PROFILE);
      const rawProfile = profileRes.data;
      const nestedProfile = (rawProfile as { data?: ProfileResponse }).data;
      const profile = (nestedProfile || rawProfile || {}) as ProfileResponse;
      const userId = String(profile.id || "").trim();

      if (!userId) {
        throw new Error(
          "Cannot subscribe websocket topics because user profile id is missing",
        );
      }

      const client = new Client({
        webSocketFactory: () => new SockJS(websocketUrl),
        reconnectDelay: 0,
        debug: (message: string) => console.log("STOMP:", message),
        onConnect: () => {
          reconnectAttempts.current = 0;
          setState((prev) => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            error: null,
          }));

          client.subscribe(
            `/topic/notifications/${userId}`,
            (frame: IMessage) => {
              try {
                const parsed = JSON.parse(frame.body) as unknown;
                const message = mapPayloadToWebSocketMessage(parsed);
                setState((prev) => ({ ...prev, lastMessage: message }));
              } catch (error) {
                logError(error, "WebSocket Notification Parse");
              }
            },
          );

          client.subscribe(
            `/topic/reservations/${userId}`,
            (frame: IMessage) => {
              try {
                console.log("[WebSocket] Reservation frame received:", {
                  topic: `/topic/reservations/${userId}`,
                  body: frame.body,
                });
                const parsed = JSON.parse(frame.body) as unknown;
                console.log("[WebSocket] Reservation payload parsed:", parsed);
                const message = mapPayloadToWebSocketMessage(parsed);
                console.log("[WebSocket] Reservation message mapped:", message);
                setState((prev) => ({ ...prev, lastMessage: message }));
              } catch (error) {
                logError(error, "WebSocket Reservation Parse");
              }
            },
          );

          console.log(
            `🔌 WebSocket Connected via SockJS/STOMP for user ${userId}`,
          );
        },
        onWebSocketClose: () => {
          if (isUnmountedRef.current) return;

          setState((prev) => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
          }));

          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            window.setTimeout(
              () => {
                if (!isUnmountedRef.current) {
                  connect().catch((error) =>
                    logError(error, "WebSocket Reconnect"),
                  );
                }
              },
              Math.pow(2, reconnectAttempts.current) * 1000,
            );
          }
        },
        onStompError: (frame: Frame) => {
          setState((prev) => ({
            ...prev,
            error: frame.headers.message || "STOMP protocol error",
            isConnecting: false,
          }));
          console.error("❌ STOMP Error:", frame);
        },
        onWebSocketError: (error: Event) => {
          setState((prev) => ({
            ...prev,
            error: "WebSocket connection error",
            isConnecting: false,
          }));
          console.error("❌ WebSocket Error:", error);
        },
      });

      clientRef.current = client;
      client.activate();
    } catch (error) {
      logError(error, "WebSocket Connect");
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create WebSocket connection",
        isConnecting: false,
      }));
    }
  }, [websocketUrl]);

  const sendMessage = useCallback(
    (message: Omit<WebSocketMessage, "timestamp">) => {
      const client = clientRef.current;
      if (!client?.connected) {
        console.warn("⚠️ WebSocket not connected. Cannot send message.");
        return;
      }

      client.publish({
        destination: "/app/message",
        body: JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        }),
      });
    },
    [],
  );

  useEffect(() => {
    isUnmountedRef.current = false;
    connect().catch((error) => logError(error, "WebSocket Initial Connect"));

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
  };
};
