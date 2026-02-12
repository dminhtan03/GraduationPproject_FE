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
    LIST: "/api/v1/rooms",
    DETAIL: "/api/v1/rooms/:id",
    BOOK: "/api/v1/reservations",
  },

  // User endpoints
  USERS: {
    LIST: "/users",
    DETAIL: "/users/:id",
    CREATE: "/users",
    UPDATE: "/users/:id",
    DELETE: "/users/:id",
    CHANGE_PASSWORD: "/api/v1/user/change-password",
    FORGOT_PASSWORD_REQUEST: "/api/v1/user/forgot-password",
    FORGOT_PASSWORD_VERIFY: "/api/v1/user/verify-forgot-password",
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
