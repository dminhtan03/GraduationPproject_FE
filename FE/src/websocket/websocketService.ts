// ===== WEBSOCKET SERVICE CHO LIVE DATA =====
// File này implement WebSocket connection với auto-reconnect và error handling

import type { WebSocketMessage, DemoData } from "../types";
import { logError } from "../utils/errorHandlers";

// Class để quản lý WebSocket connection
class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private listeners: Map<string, ((message: WebSocketMessage) => void)[]> =
    new Map();
  private dataUpdateInterval: number | null = null;

  constructor(url: string = "wss://demo.websocket.com") {
    this.url = url;
    this.setupEventListeners();
  }

  // ===== PUBLIC METHODS =====

  // Kết nối WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error("Already connecting"));
        return;
      }

      try {
        // Simulate WebSocket connection thay vì real connection
        // Điều này giúp demo hoạt động mà không cần WebSocket server thật
        console.log("🔌 WebSocket Service Connected (Simulated)");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startLiveDataSimulation();
        this.notifyListeners("connect", {
          type: "notification",
          data: { message: "Connected successfully (Simulated)" },
          timestamp: new Date().toISOString(),
        });
        resolve();
      } catch (error) {
        logError(error, "WebSocket Connect");
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // Ngắt kết nối WebSocket
  disconnect(): void {
    this.stopLiveDataSimulation();
    if (this.ws) {
      this.ws.close(1000, "User disconnected");
      this.ws = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    console.log("🔌 WebSocket Service Disconnected (Manual)");
  }

  // Kiểm tra trạng thái kết nối
  isConnected(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN || this.dataUpdateInterval !== null
    );
  }

  // Gửi message qua WebSocket
  send(message: WebSocketMessage): void {
    if (!this.isConnected()) {
      throw new Error("WebSocket is not connected");
    }

    try {
      if (this.ws) {
        this.ws.send(JSON.stringify(message));
      } else {
        // Simulate message sending trong demo mode
        console.log("📤 WebSocket Message Sent (Simulated):", message);
      }
    } catch (error) {
      logError(error, "WebSocket Send");
      throw error;
    }
  }

  // ===== EVENT LISTENERS =====

  // Đăng ký listener cho event
  on(event: string, callback: (message: WebSocketMessage) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // Hủy đăng ký listener
  off(event: string, callback: (message: WebSocketMessage) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // ===== PRIVATE METHODS =====

  // Setup các event listener cơ bản
  private setupEventListeners(): void {
    // Handle window unload để cleanup connections
    window.addEventListener("beforeunload", () => {
      this.disconnect();
    });
  }

  // Xử lý khi nhận được message từ WebSocket
  private handleMessage(message: WebSocketMessage): void {
    console.log("📨 WebSocket Message Received:", message);
    this.notifyListeners("message", message);
    // Xử lý theo loại message
    if (message.type === "update") {
      this.notifyListeners("data", message);
    }
  }

  // Thông báo cho tất cả listeners
  private notifyListeners(event: string, message: WebSocketMessage): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(message);
        } catch (error) {
          logError(error, `WebSocket Listener (${event})`);
        }
      });
    }
  }

  // Schedule reconnection sau khi bị disconnect
  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(
      `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`
    );

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((error) => {
        logError(error, "WebSocket Reconnect");
      });
    }, delay);
  }

  // ===== DEMO DATA SIMULATION =====

  // Bắt đầu simulation data cho demo
  private startLiveDataSimulation(): void {
    if (this.dataUpdateInterval) {
      return;
    }

    this.dataUpdateInterval = window.setInterval(() => {
      const demoData: DemoData = this.generateDemoData();
      const message: WebSocketMessage = {
        type: "update",
        data: demoData,
        timestamp: new Date().toISOString(),
      };

      this.handleMessage(message);
    }, 2000); // Update mỗi 2 giây

    console.log("📊 Live data simulation started");
  }

  // Dừng simulation data
  private stopLiveDataSimulation(): void {
    if (this.dataUpdateInterval) {
      window.clearInterval(this.dataUpdateInterval);
      this.dataUpdateInterval = null;
      console.log("📊 Live data simulation stopped");
    }
  }
  // Generate random demo data
  private generateDemoData(): DemoData {
    const now = new Date();
    return {
      id: Math.floor(Math.random() * 1000) + 1,
      title: `Data Point ${Math.floor(Math.random() * 1000)}`,
      value: Math.floor(Math.random() * 100) + 1,
      timestamp: now.toISOString(),
    };
  }
}

// ===== WEBSOCKET MANAGER =====

// Singleton instance cho WebSocket service
class WebSocketManager {
  private static instance: WebSocketService | null = null;

  static getInstance(url?: string): WebSocketService {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketService(url);
    }
    return WebSocketManager.instance;
  }

  static destroyInstance(): void {
    if (WebSocketManager.instance) {
      WebSocketManager.instance.disconnect();
      WebSocketManager.instance = null;
    }
  }
}

// Export default instance
export default WebSocketManager.getInstance();
export { WebSocketService, WebSocketManager };
