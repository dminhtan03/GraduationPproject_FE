// ===== CUSTOM HOOK CHO WEBSOCKET =====

import { useState, useEffect, useRef, useCallback } from "react";
import { WebSocketMessage } from "../types";
import { API_CONFIG, WS_MESSAGE_TYPES } from "../constants";
import { logError } from "../utils/errorHandlers";

// Interface cho WebSocket state
interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
}

// Hook cho WebSocket connection
export const useWebSocket = (url?: string) => {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
  });
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // URL mặc định
  const websocketUrl = url || API_CONFIG.WEBSOCKET_URL;

  // Function để kết nối WebSocket
  const connect = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return; // Đã kết nối rồi
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(websocketUrl);
      websocketRef.current = ws;

      // Khi kết nối thành công
      ws.onopen = () => {
        console.log("🔌 WebSocket Connected");
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));
        reconnectAttempts.current = 0;

        // Gửi message connect
        ws.send(
          JSON.stringify({
            type: WS_MESSAGE_TYPES.CONNECT,
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
          })
        );
      };

      // Khi nhận được message
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log("📨 WebSocket Message:", message);

          setState((prev) => ({ ...prev, lastMessage: message }));
        } catch (error) {
          logError(error, "WebSocket Message Parse");
        }
      };

      // Khi bị ngắt kết nối
      ws.onclose = (event) => {
        console.log("🔌 WebSocket Disconnected:", event.code, event.reason);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        // Auto reconnect nếu không phải do người dùng đóng
        if (
          event.code !== 1000 &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            console.log(
              `🔄 Reconnecting... Attempt ${reconnectAttempts.current}`
            );
            connect();
          }, delay);
        }
      };

      // Khi có lỗi
      ws.onerror = (error) => {
        console.error("❌ WebSocket Error:", error);
        setState((prev) => ({
          ...prev,
          error: "WebSocket connection error",
          isConnecting: false,
        }));
      };
    } catch (error) {
      logError(error, "WebSocket Connect");
      setState((prev) => ({
        ...prev,
        error: "Failed to create WebSocket connection",
        isConnecting: false,
      }));
    }
  }, [websocketUrl]);

  // Function để ngắt kết nối
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (websocketRef.current) {
      websocketRef.current.close(1000, "User initiated disconnect");
      websocketRef.current = null;
    }

    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: null,
    });
  }, []);

  // Function để gửi message
  const sendMessage = useCallback(
    (message: Omit<WebSocketMessage, "timestamp">) => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        const fullMessage: WebSocketMessage = {
          ...message,
          timestamp: new Date().toISOString(),
        };

        websocketRef.current.send(JSON.stringify(fullMessage));
        console.log("📤 WebSocket Send:", fullMessage);
      } else {
        console.warn("⚠️ WebSocket not connected. Cannot send message.");
      }
    },
    []
  );
  // Auto connect khi component mount
  useEffect(() => {
    connect();

    // Cleanup khi component unmount
    return () => {
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
