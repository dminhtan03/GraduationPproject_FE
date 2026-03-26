import { api } from "./api";
import { API_ENDPOINTS, buildUrl } from "../constants/endpoints";

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  department: string;
  enabled: boolean;
  locked: boolean;
  reason?: string;
};

export type RegisterUserPayload = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  department: string;
  email: string;
  gender: string;
  password: string;
  role: string;
};

export type AdminOverviewStatItem = {
  value: number;
  change: number;
};

export type AdminOverviewStats = {
  totalBookings: AdminOverviewStatItem;
  activeUsers: AdminOverviewStatItem;
  utilizationRate: AdminOverviewStatItem;
  todaysBookings: AdminOverviewStatItem;
};

type BackendPage<T> = {
  content?: T[];
  totalElements?: number;
  number?: number;
  size?: number;
};

type BackendMeta = {
  total?: number;
  page?: number;
  size?: number;
};

type BackendUser = {
  id?: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  enabled?: boolean;
  locked?: boolean;
  isLocked?: boolean;
  reason?: string | null;
  lockReason?: string | null;
  lockedReason?: string | null;
};

type BackendReservation = {
  id?: string;
  reservationId?: string;
  bookingId?: string;
  userName?: string | null;
  username?: string | null;
  fullName?: string | null;
  userEmail?: string | null;
  roomName?: string | null;
  floorName?: string | null;
  buildingName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  roomType?: string | null;
  building?: {
    id?: string | null;
    name?: string | null;
    address?: string | null;
  } | null;
  floor?: {
    id?: string | null;
    name?: string | null;
  } | null;
  room?: {
    name?: string | null;
    roomName?: string | null;
    locationCode?: string | null;
    type?: string | null;
    roomType?: string | null;
  } | null;
  user?: {
    fullName?: string | null;
    name?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  account?: {
    fullName?: string | null;
    name?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  booker?: {
    fullName?: string | null;
    name?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  createdBy?: string | null;
  createdByName?: string | null;
};

type AdminBooking = {
  id: string;
  reservationId: string;
  bookingId: string;
  user: string;
  userName: string;
  userEmail: string;
  room: string;
  roomName: string;
  floorName: string;
  buildingName: string;
  roomType: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  status: string;
};

type AdminBookingFilters = {
  startDate?: string;
  endDate?: string;
  userName?: string;
  userEmail?: string;
  roomName?: string;
  floorName?: string;
  buildingName?: string;
  status?: string;
};

const extractSuccessMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== "object") return fallback;

  const data = payload as {
    message?: unknown;
    meta?: { message?: unknown };
    data?: unknown;
  };

  if (typeof data.meta?.message === "string" && data.meta.message.trim()) {
    return data.meta.message;
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data.data === "string" && data.data.trim()) {
    return data.data;
  }

  return fallback;
};

const normalizeUser = (user: BackendUser): AdminUser => ({
  id: String(user.id || ""),
  fullName: String(user.fullName || ""),
  email: String(user.email || ""),
  phoneNumber: String(user.phoneNumber || ""),
  department: String(user.department || ""),
  enabled: Boolean(user.enabled),
  locked: Boolean(user.locked ?? user.isLocked),
  reason: String(user.reason ?? user.lockReason ?? user.lockedReason ?? ""),
});

const pickFirstText = (...values: Array<unknown>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const normalizeBooking = (item: BackendReservation): AdminBooking => {
  const userName = pickFirstText(
    item.userName,
    item.username,
    item.fullName,
    item.user?.fullName,
    item.user?.name,
    item.user?.username,
    item.account?.fullName,
    item.account?.name,
    item.account?.username,
    item.booker?.fullName,
    item.booker?.name,
    item.booker?.username,
    item.createdByName,
    item.createdBy,
  );

  const roomName = pickFirstText(
    item.roomName,
    item.room?.name,
    item.room?.roomName,
    item.room?.locationCode,
  );

  return {
    id: String(item.id || item.reservationId || item.bookingId || ""),
    reservationId: String(
      item.reservationId || item.id || item.bookingId || "",
    ),
    bookingId: String(item.bookingId || item.reservationId || item.id || ""),
    user: userName,
    userName,
    userEmail: pickFirstText(
      item.userEmail,
      item.user?.email,
      item.account?.email,
      item.booker?.email,
    ),
    room: roomName,
    roomName,
    floorName: pickFirstText(item.floorName, item.floor?.name),
    buildingName: pickFirstText(item.buildingName, item.building?.name),
    roomType: pickFirstText(
      item.roomType,
      item.room?.type,
      item.room?.roomType,
    ),
    startTime: item.startTime || item.startDate || undefined,
    endTime: item.endTime || item.endDate || undefined,
    date:
      item.endTime ||
      item.endDate ||
      item.startTime ||
      item.startDate ||
      undefined,
    status: String(item.status || ""),
  };
};

const normalizeOverviewStatItem = (item: unknown): AdminOverviewStatItem => {
  if (!item || typeof item !== "object") {
    return { value: 0, change: 0 };
  }

  const stat = item as { value?: unknown; change?: unknown };
  return {
    value: Number(stat.value ?? 0),
    change: Number(stat.change ?? 0),
  };
};

const extractUsersAndMeta = (
  payload: unknown,
): {
  users: BackendUser[];
  total?: number;
  page?: number;
  size?: number;
} => {
  const wrapped = payload as { data?: unknown; meta?: BackendMeta };
  const meta = wrapped?.meta || {};
  const data = wrapped?.data;

  // Current BE shape for Page response: { data: User[], meta: { total, page, size } }
  if (Array.isArray(data)) {
    return {
      users: data as BackendUser[],
      total: meta.total,
      page: meta.page,
      size: meta.size,
    };
  }

  // Fallback: some APIs may still return Spring Page-like object
  const pageLike = (data ?? payload) as BackendPage<BackendUser>;
  if (Array.isArray(pageLike.content)) {
    return {
      users: pageLike.content,
      total: pageLike.totalElements,
      page: pageLike.number,
      size: pageLike.size,
    };
  }

  return { users: [] };
};

export const adminService = {
  async getOverviewStats(): Promise<AdminOverviewStats> {
    const res = await api.get<any>(API_ENDPOINTS.DASHBOARD.OVERVIEW_STATS);
    const payload = res.data?.data ?? res.data ?? {};

    return {
      totalBookings: normalizeOverviewStatItem(payload.totalBookings),
      activeUsers: normalizeOverviewStatItem(payload.activeUsers),
      utilizationRate: normalizeOverviewStatItem(payload.utilizationRate),
      todaysBookings: normalizeOverviewStatItem(payload.todaysBookings),
    };
  },

  async getAllUsers(
    page = 0,
    size = 100,
  ): Promise<{
    items: AdminUser[];
    total: number;
    page: number;
    size: number;
  }> {
    const res = await api.get<any>(API_ENDPOINTS.DASHBOARD.ALL_USERS, {
      params: { page, size },
    });

    const parsed = extractUsersAndMeta(res.data);
    const content = parsed.users;

    return {
      items: content.map(normalizeUser),
      total: Number(parsed.total ?? content.length),
      page: Number(parsed.page ?? page),
      size: Number(parsed.size ?? size),
    };
  },

  async lockUser(userId: string): Promise<string> {
    const res = await api.put(
      buildUrl(API_ENDPOINTS.DASHBOARD.LOCK_USER, { userId }),
    );
    return extractSuccessMessage(res.data, "User locked successfully");
  },

  async unlockUser(userId: string): Promise<string> {
    const res = await api.put(
      buildUrl(API_ENDPOINTS.DASHBOARD.UNLOCK_USER, { userId }),
    );
    return extractSuccessMessage(res.data, "User unlocked successfully");
  },

  async registerUser(payload: RegisterUserPayload): Promise<void> {
    await api.post(API_ENDPOINTS.USERS.REGISTER, payload);
  },

  // start add admin api calls
  async adminAddUser(payload: RegisterUserPayload): Promise<void> {
    await api.post(API_ENDPOINTS.USERS.ADMIN_ADD, payload);
  },

  async importUsersExcel(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    await api.post(API_ENDPOINTS.USERS.ADMIN_IMPORT_EXCEL, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  async importRoomsExcel(file: File, floorId: string): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("floorId", floorId);
    await api.post(API_ENDPOINTS.ROOMS.IMPORT_EXCEL, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  // end add admin api calls

  // start add building management api calls
  async getAllBuildings(): Promise<any> {
    const res = await api.get(API_ENDPOINTS.ROOMS.ADMIN_BUILDINGS);
    return (res.data as any)?.data || res.data;
  },

  async getFloorsByBuilding(buildingId: string): Promise<any> {
    const res = await api.get(
      buildUrl(API_ENDPOINTS.ROOMS.ADMIN_FLOORS, { buildingId }),
    );
    return (res.data as any)?.data || res.data;
  },

  async getRoomsByFloor(floorId: string): Promise<any> {
    const res = await api.get(
      buildUrl(API_ENDPOINTS.ROOMS.ADMIN_ROOMS_BY_FLOOR, { floorId }),
    );
    return (res.data as any)?.data || res.data;
  },

  async createBuilding(payload: {
    name: string;
    address: string;
    totalFloors: number;
  }): Promise<void> {
    await api.post(API_ENDPOINTS.ROOMS.CREATE_BUILDING, payload);
  },
  // end add building management api calls

  // start add admin booking list api
  async getAllBookings(
    page = 0,
    size = 20,
    filters?: AdminBookingFilters,
  ): Promise<{
    items: AdminBooking[];
    total: number;
    page: number;
    size: number;
  }> {
    const params: Record<string, string | number> = { page, size };
    if (filters?.startDate) {
      params.startDate = filters.startDate;
      params.startTime = filters.startDate;
    }
    if (filters?.endDate) {
      params.endDate = filters.endDate;
      params.endTime = filters.endDate;
    }
    if (filters?.userName) {
      params.userName = filters.userName;
      params.username = filters.userName;
    }
    if (filters?.userEmail) {
      params.userEmail = filters.userEmail;
      params.email = filters.userEmail;
    }
    if (filters?.roomName) {
      params.roomName = filters.roomName;
    }
    if (filters?.floorName) {
      params.floorName = filters.floorName;
    }
    if (filters?.buildingName) {
      params.buildingName = filters.buildingName;
    }
    if (filters?.status) {
      params.status = filters.status;
    }

    const res = await api.get<any>(API_ENDPOINTS.DASHBOARD.ALL_RESERVATIONS, {
      params,
    });

    const payload = res.data || {};
    const responseData = payload?.data ?? payload;
    const meta = payload?.meta ?? {};

    let items: BackendReservation[] = [];
    let total = 0;

    // Handle different response formats
    if (Array.isArray(responseData)) {
      items = responseData;
      total = responseData.length;
    } else if (Array.isArray(responseData?.content)) {
      items = responseData.content;
      total = responseData?.totalElements ?? responseData.content.length;
    } else if (Array.isArray(responseData?.items)) {
      items = responseData.items;
      total = responseData?.total ?? items.length;
    }

    return {
      items: items.map(normalizeBooking),
      total: Number(meta?.total ?? total) || 0,
      page: Number(meta?.page ?? page) || 0,
      size: Number(meta?.size ?? size) || 20,
    };
  },
  // end add admin booking list api
};
