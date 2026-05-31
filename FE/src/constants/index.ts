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
  LOGIN: "/login",
  FORBIDDEN: "/403",
  NOT_FOUND: "/404",
  FORGOT_PASSWORD: "/forgot-password",
  ABOUT: "/about",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_USER_MANAGEMENT: "/admin/user-management",
  ADMIN_ALL_BOOKINGS: "/admin/all-bookings",
  ADMIN_BOOKING_DETAIL: "/admin/all-bookings/:bookingId",
  ROOM_LIST: "/room-list",
  ROOM_MAP: "/room-map",
  ROOM_DETAIL: "/rooms/:roomId",
  BOOK_ROOM: "/book-room/:roomId",
  // start+ chức năng 3 màn hình đặt phòng (thường / định kì / sự kiện)
  BOOK_ROOM_RECURRING: "/book-room-recurring/:roomId",
  BOOK_ROOM_EVENT: "/book-room-event/:roomId",
  // end+ chức năng 3 màn hình đặt phòng (thường / định kì / sự kiện)
  MY_BOOKINGS: "/my-bookings",
  BOOKING_DETAIL: "/my-bookings/:bookingId",
  AI_ASSISTANT: "/ai-assistant",
  NOTIFICATIONS: "/notifications",
  PROFILE: "/profile",
  PROFILE_EDIT: "/profile/edit",
  CHANGE_PASSWORD: "/profile/change-password",
  LOG_OUT: "/logout",
  // start add admin building routes
  ADMIN_BUILDING_MANAGEMENT: "/admin/buildings",
  ADMIN_BUILDING_FLOORS: "/admin/buildings/:buildingId/floors",
  ADMIN_ROOM_MANAGEMENT: "/admin/buildings/:buildingId/floors/:floorId/rooms",
  ADMIN_AMENITY_MANAGEMENT: "/admin/amenities",
  ADMIN_FLOOR_LAYOUT: "/admin/buildings/:buildingId/floors/:floorId/layout",
  ADMIN_ACADEMIC_SCHEDULE: "/admin/academic-schedules",
  ADMIN_EVENT_BOOKINGS: "/admin/event-bookings",
  ADMIN_EVENT_BOOKING_DETAIL: "/admin/event-bookings/:reservationId",
  // start+ chức năng CRUD dịch vụ đi kèm + check-in QR + đặt phòng lặp lại
  ADMIN_SERVICE_ITEMS: "/admin/service-items",
  // start+ chức năng admin quản lý recurring series
  ADMIN_RECURRING_SERIES: "/admin/recurring-series",
  // end+ chức năng admin quản lý recurring series
  ADMIN_FEEDBACK_MANAGEMENT: "/admin/feedback",
  CHECKIN_QR: "/checkin-qr",
  MY_RECURRING_SERIES: "/my-recurring-series",
  EVENT_DEMO: "/event-demo",
  // start+ chức năng đặt phòng theo sự kiện (setup + màn hình sự kiện đang diễn ra)
  EVENT_SETUP: "/events/setup/:reservationId",
  EVENT_LIVE: "/events/live/:reservationId",
  // end+ chức năng đặt phòng theo sự kiện (setup + màn hình sự kiện đang diễn ra)
  // end+ chức năng CRUD dịch vụ đi kèm + check-in QR + đặt phòng lặp lại
  // end add admin building routes
  // Task Management
  TASKS: "/tasks",
  TASK_CREATE: "/tasks/create",
  TASK_DETAIL: "/tasks/:taskId",
  // Project Management
  PROJECTS: "/projects",
  PROJECT_CREATE: "/projects/create",
  PROJECT_DETAIL: "/projects/:projectId",
  // Meeting Management
  MEETINGS: "/meetings",
  MEETING_DETAIL: "/meetings/:meetingId",
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  USER_TOKEN: "user_token",
  REFRESH_TOKEN: "refresh_token",
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

export const AUTH_EVENTS = {
  TOKEN_CHANGED: "auth-token-changed",
} as const;

// App settings
export const APP_CONFIG = {
  APP_NAME: "Base React App",
  VERSION: "1.0.0",
  AUTHOR: "Fresher Team",
  DEFAULT_PAGE_SIZE: 10,
  MAX_RETRY_ATTEMPTS: 3,
};
