// ===== CẤU HÌNH ENDPOINTS API =====

export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
    PROFILE: "/auth/profile",
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
