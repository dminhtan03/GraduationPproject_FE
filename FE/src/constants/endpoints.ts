// ===== CẤU HÌNH ENDPOINTS API =====

export const API_ENDPOINTS = {
  // Auth endpoints (mapping BE `/api/v1/auth/*`)
  // - POST http://localhost:8080/api/v1/auth/doLogin
  // - POST http://localhost:8080/api/v1/auth/doLogout
  // - POST http://localhost:8080/api/v1/auth/refreshToken?refreshToken=...
  AUTH: {
    LOGIN: "/api/v1/auth/doLogin",
    GOOGLE_LOGIN: "/api/v1/auth/google-login",
    LOGOUT: "/api/v1/auth/doLogout",
    REFRESH: "/api/v1/auth/refreshToken",
    PROFILE: "/api/v1/auth/profile",
  },

  // Room endpoints
  // e.g. GET /api/v1/rooms?page=0&size=5&status=AVAILABLE&minCapacity=20
  ROOMS: {
    LIST: "/api/v1/rooms-map",
    DETAIL: "/api/v1/rooms/:id",
    BOOK: "/api/v1/reservations",
    MY_STATUS: "/api/v1/reservations/my-status",
    CHECK_IN: "/api/v1/reservations/check-in/:id",
    RETURN_ROOM: "/api/v1/reservations/return-room/:id",
    EXTEND_ROOM: "/api/v1/reservations/extend/:id",
    CANCEL_BOOKING: "/api/v1/reservations/cancel/:id",
  },

  // User endpoints
  USERS: {
    LIST: "/users",
    DETAIL: "/users/:id",
    CREATE: "/users",
    UPDATE: "/users/:id",
    DELETE: "/users/:id",
    UPDATE_INFO: "/api/v1/user/update-info",
    CHANGE_PASSWORD: "/api/v1/user/change-password",
    FORGOT_PASSWORD_REQUEST: "/api/v1/user/forgot-password",
    FORGOT_PASSWORD_VERIFY: "/api/v1/user/verify-forgot-password",
    RESEND_OTP: "/api/v1/user/resend-otp",
  },
  // Demo data endpoints (sử dụng JSONPlaceholder)
  DEMO: {
    POSTS: "/posts",
    COMMENTS: "/comments",
    ALBUMS: "/albums",
    PHOTOS: "/photos",
    TODOS: "/todos",
    USERS: "/users",
  },
  // AI assistant endpoints
  AI: {
    CHAT: "/api/v1/ai/chat",
    RESERVE: "/api/v1/ai/reserve",
  },

  FEEDBACK: {
    CREATE: "/api/v1/feedback/add",
    LIST: "/api/v1/feedback",
  },

  DASHBOARD: {
    ALL_USERS: "/api/v1/dashboard/all-users",
    LOCK_USER: "/api/v1/dashboard/lock-user/:userId",
    UNLOCK_USER: "/api/v1/dashboard/unlock-user/:userId",
  },
} as const;

// Helper function để build URL với params
export const buildUrl = (
  endpoint: string,
  params?: Record<string, string | number>,
) => {
  if (!params) return endpoint;

  let url = endpoint;
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, String(value));
  });

  return url;
};
