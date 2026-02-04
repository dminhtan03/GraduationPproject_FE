// ===== CẤU HÌNH ENDPOINTS API =====

export const API_ENDPOINTS = {
  // Auth endpoints (mapping BE `/api/v1/auth/*`)
  // Với `VITE_API_URL=http://localhost:8080` thì URL đầy đủ sẽ là:
  // - POST http://localhost:8080/api/v1/auth/doLogin
  // - POST http://localhost:8080/api/v1/auth/doLogout
  // - POST http://localhost:8080/api/v1/auth/refreshToken?refreshToken=...
  AUTH: {
    LOGIN: "/api/v1/auth/doLogin",
    GOOGLE_LOGIN: "/api/v1/auth/google", // BE chưa có, placeholder
    LOGOUT: "/api/v1/auth/doLogout",
    REFRESH: "/api/v1/auth/refreshToken",
    PROFILE: "/api/v1/user/profile", // BE chưa có, placeholder
  },

  // User endpoints
  USERS: {
    LIST: "/users",
    DETAIL: "/users/:id",
    CREATE: "/users",
    UPDATE: "/users/:id",
    DELETE: "/users/:id",
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
  params?: Record<string, string | number>
) => {
  if (!params) return endpoint;

  let url = endpoint;
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, String(value));
  });

  return url;
};
