import { useEffect, useMemo, useRef } from "react";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_CONFIG } from "../constants";

type MapRoomStatus = "AVAILABLE" | "UNAVAILABLE" | "BROKEN";

type RoomStatusRealtimePayload = {
  roomId?: string;
  newStatus?: string;
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

const normalizeRealtimeRoomStatus = (status?: string): MapRoomStatus | null => {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  if (normalized === "AVAILABLE") return "AVAILABLE";
  if (normalized === "UNAVAILABLE") return "UNAVAILABLE";
  if (normalized === "BROKEN") return "BROKEN";
  return null;
};

interface UseRoomStatusWebSocketOptions {
  floorId: string | null;
  onStatusChange: (roomId: string, nextStatus: MapRoomStatus) => void;
}

export const useRoomStatusWebSocket = ({
  floorId,
  onStatusChange,
}: UseRoomStatusWebSocketOptions) => {
  const websocketUrl = useMemo(() => normalizeSockJsUrl(), []);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    if (!floorId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("[RoomStatusWS] Connected:", {
          floorId,
          topic: `/topic/rooms/${floorId}`,
        });

        client.subscribe(`/topic/rooms/${floorId}`, (frame: IMessage) => {
          try {
            const payload = JSON.parse(frame.body) as RoomStatusRealtimePayload;
            const roomId = String(payload.roomId || "").trim();
            const nextStatus = normalizeRealtimeRoomStatus(payload.newStatus);

            console.log("[RoomStatusWS] Message received:", {
              floorId,
              body: frame.body,
              roomId,
              nextStatus,
            });

            if (!roomId || !nextStatus) {
              return;
            }

            onStatusChangeRef.current(roomId, nextStatus);
          } catch {
            // Ignore malformed websocket payloads.
          }
        });
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [floorId, websocketUrl]);
};
