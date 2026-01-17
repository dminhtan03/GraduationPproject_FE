// ===== CÁC HẰNG SỐ CỦA ỨNG DỤNG =====

// API URLs
export const API_CONFIG = {
  BASE_URL:
    import.meta.env.VITE_API_URL || "https://jsonplaceholder.typicode.com",
  WEBSOCKET_URL: import.meta.env.VITE_WS_URL || "ws://localhost:8080",
  TIMEOUT: 10000, // 10 giây
};

// Routes constants
export const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  DASHBOARD: "/dashboard",
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  USER_TOKEN: "user_token",
  USER_DATA: "user_data",
  THEME: "app_theme",
  LANGUAGE: "app_language",
} as const;

// WebSocket message types
export const WS_MESSAGE_TYPES = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  UPDATE_DATA: "update_data",
  NOTIFICATION: "notification",
  ERROR: "error",
} as const;

// App settings
export const APP_CONFIG = {
  APP_NAME: "Base React App",
  VERSION: "1.0.0",
  AUTHOR: "Fresher Team",
  DEFAULT_PAGE_SIZE: 10,
  MAX_RETRY_ATTEMPTS: 3,
};
