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
  LOGIN: "/login",
  FORBIDDEN: "/403",
  NOT_FOUND: "/404",
  FORGOT_PASSWORD: "/forgot-password",
  ABOUT: "/about",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ROOM_LIST: "/room-list",
  ROOM_MAP: "/room-map",
  ROOM_DETAIL: "/rooms/:roomId",
  BOOK_ROOM: "/book-room/:roomId",
  MY_BOOKINGS: "/my-bookings",
  AI_ASSISTANT: "/ai-assistant",
  NOTIFICATIONS: "/notifications",
  PROFILE: "/profile",
  PROFILE_EDIT: "/profile/edit",
  CHANGE_PASSWORD: "/profile/change-password",
  LOG_OUT: "/logout",
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  USER_TOKEN: "user_token",
  THEME: "app_theme",
  LANGUAGE: "app_language",
  FORCED_PASSWORD_CHANGE: "force_password_change",
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
