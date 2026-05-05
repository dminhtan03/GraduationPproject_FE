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
    SEARCH: "/api/v1/rooms/search",
    DETAIL: "/api/v1/rooms/:id",
    DETAIL_RESERVATION: "/api/v1/reservations/detail-reservation/:id",
    BOOK: "/api/v1/reservations",
    MY_STATUS: "/api/v1/reservations/my-status",
    CHECK_IN: "/api/v1/reservations/check-in/:id",
    RETURN_ROOM: "/api/v1/reservations/return-room/:id",
    EXTEND_ROOM: "/api/v1/reservations/extend/:id",
    MAX_EXTEND: "/api/v1/reservations/extend/:id/max",
    CANCEL_BOOKING: "/api/v1/reservations/cancel/:id",
    FORCE_CANCEL_BOOKING: "/api/v1/reservations/force-cancel/:id",
    // start+ chức năng sự kiện (gọi thêm dịch vụ/tiện ích trong lúc diễn ra)
    RESERVATION_SERVICE_ITEMS: "/api/v1/reservations/:id/service-items",
    // start+ chức năng service item status
    RESERVATION_SERVICE_ITEM_STATUS: "/api/v1/reservations/:reservationId/service-items/:itemId/status",
    // end+ chức năng service item status
    // end+ chức năng sự kiện (gọi thêm dịch vụ/tiện ích trong lúc diễn ra)
    ROOM_IMAGES_BY_ROOM: "/api/v1/room-images/room/:roomId",
    // start add layout endpoint
    UPDATE_LAYOUT: "/api/v1/rooms/floors/:floorId/layout",
    IMPORT_EXCEL: "/api/v1/rooms/import-excel",
    CREATE: "/api/v1/rooms",
    GET_AMENITIES: "/api/v1/rooms/amenities",
    // end add layout endpoint
  },
  AMENITIES: {
    LIST: "/api/v1/amenities",
    CREATE: "/api/v1/amenities",
    UPDATE: "/api/v1/amenities/:id",
    DELETE: "/api/v1/amenities/:id",
  },
  // start add building endpoints
  BUILDINGS: {
    ADMIN_BUILDINGS: "/api/v1/dashboard/all-buildings",
    ADMIN_FLOORS: "/api/v1/dashboard/all-floors-by-buildingId/:buildingId",
    ADMIN_ROOMS_BY_FLOOR: "/api/v1/dashboard/all-room-by-floorId/:floorId",
    CREATE_BUILDING: "/api/v1/dashboard/buildings",
    UPDATE_BUILDING: "/api/v1/dashboard/buildings/:buildingId",
    DELETE_BUILDING: "/api/v1/dashboard/buildings/:buildingId",
    CREATE_FLOOR: "/api/v1/dashboard/buildings/:buildingId/add-floor",
  },
  // end add building endpoints

  // User endpoints
  USERS: {
    LIST: "/users",
    DETAIL: "/users/:id",
    CREATE: "/users",
    UPDATE: "/users/:id",
    DELETE: "/users/:id",
    REGISTER: "/api/v1/user/register",
    UPDATE_INFO: "/api/v1/user/update-info",
    CHANGE_PASSWORD: "/api/v1/user/change-password",
    FORGOT_PASSWORD_REQUEST: "/api/v1/user/forgot-password",
    FORGOT_PASSWORD_VERIFY: "/api/v1/user/verify-forgot-password",
    RESEND_OTP: "/api/v1/user/resend-otp",
    // start add admin endpoints
    ADMIN_ADD: "/api/v1/user/admin/add",
    ADMIN_IMPORT_EXCEL: "/api/v1/user/admin/import-excel",
    // end add admin endpoints
    // start+ check email exists
    CHECK_EMAIL: "/api/v1/user/check-email",
    // end+ check email exists
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
    ADD_CHAT: "/api/v1/chatbot/session",
    CHAT: "/api/v1/chatbot/message",
    VOICE: "/api/v1/chatbot/voice",
    DELETE_CHAT: "/api/v1/chatbot/session/:sessionId",
    HISTORY: "/api/v1/chatbot/history",
    HISTORY_DETAIL: "/api/v1/chatbot/history/:sessionId",
    RESERVE: "/api/v1/ai/reserve",
  },

  FEEDBACK: {
    CREATE: "/api/v1/feedback/add",
    LIST: "/api/v1/feedback",
    ADMIN_LIST: "/api/v1/feedback/admin",
    ADMIN_DETAIL: "/api/v1/feedback/admin/:id",
  },

  NOTIFICATIONS: {
    LIST: "/api/v1/notifications/getAll",
    MARK_AS_READ: "/api/v1/notifications/markAsRead/:notificationId",
  },

  ACADEMIC_SCHEDULES: {
    LIST: "/api/v1/academic-schedules",
    CREATE: "/api/v1/academic-schedules",
    UPDATE: "/api/v1/academic-schedules/:id",
    DELETE: "/api/v1/academic-schedules/:id",
    IMPORT: "/api/v1/academic-schedules/import",
    BY_ROOM: "/api/v1/academic-schedules/room/:roomId",
  },

  // start+ chức năng CRUD dịch vụ đi kèm + đặt phòng theo sự kiện + QR + đặt phòng lặp lại
  SERVICE_ITEMS: {
    LIST: "/api/v1/service-items",
    CREATE: "/api/v1/service-items",
    UPDATE: "/api/v1/service-items/:id",
    DELETE: "/api/v1/service-items/:id",
  },
  EVENTS: {
    CREATE: "/api/v1/events",
    BY_RESERVATION: "/api/v1/events/by-reservation/:reservationId",
    PARTICIPANTS: "/api/v1/events/:eventId/participants",
    INVITE_PARTICIPANT: "/api/v1/events/participants",
    MY_INVITATIONS: "/api/v1/events/my-invitations",
    RESPOND_INVITATION: "/api/v1/events/participants/:participantId/respond",
    PARTICIPANT_HISTORY: "/api/v1/events/participants/:participantId/history",
    REMOVE_PARTICIPANT: "/api/v1/events/participants/:participantId",
    ADMIN_ALL: "/api/v1/events/admin/all",
  },
  CHECKIN_QR: {
    GENERATE_RESERVATION: "/api/v1/checkin-qr/reservation/:reservationId",
    GENERATE_PARTICIPANT: "/api/v1/checkin-qr/participant/:participantId",
    GENERATE_PARTICIPANT_OTP: "/api/v1/checkin-qr/participant/:participantId/otp",
    CONSUME: "/api/v1/checkin-qr/consume",
    GET_LIVE_CODE: "/api/v1/checkin-qr/live-code/:reservationId",
    CHECK_IN_CODE: "/api/v1/checkin-qr/check-in-code/:reservationId",
  },
  RESERVATION_SERIES: {
    CREATE: "/api/v1/reservation-series",
    MY: "/api/v1/reservation-series/my",
    SYNC: "/api/v1/reservation-series/:seriesId/sync",
    CANCEL: "/api/v1/reservation-series/:seriesId",
    PREVIEW: "/api/v1/reservation-series/preview",
    // start+ chức năng admin quản lý recurring series
    ADMIN_ALL: "/api/v1/reservation-series/admin/all",
    // end+ chức năng admin quản lý recurring series
  },
  // end+ chức năng CRUD dịch vụ đi kèm + đặt phòng theo sự kiện + QR + đặt phòng lặp lại

  DASHBOARD: {
    OVERVIEW_STATS: "/api/v1/dashboard/overview-stats",
    ALL_USERS: "/api/v1/dashboard/all-users",
    LOCK_USER: "/api/v1/dashboard/lock-user/:userId",
    UNLOCK_USER: "/api/v1/dashboard/unlock-user/:userId",
    ALL_RESERVATIONS: "/api/v1/dashboard/reservations",
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
