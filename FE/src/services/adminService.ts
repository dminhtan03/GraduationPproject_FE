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
});

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
    return res.data?.data || res.data;
  },

  async getFloorsByBuilding(buildingId: string): Promise<any> {
    const res = await api.get(
      buildUrl(API_ENDPOINTS.ROOMS.ADMIN_FLOORS, { buildingId }),
    );
    return res.data?.data || res.data;
  },

  async getRoomsByFloor(floorId: string): Promise<any> {
    const res = await api.get(
      buildUrl(API_ENDPOINTS.ROOMS.ADMIN_ROOMS_BY_FLOOR, { floorId }),
    );
    return res.data?.data || res.data;
  },

  async createBuilding(payload: {
    name: string;
    address: string;
    totalFloors: number;
  }): Promise<void> {
    await api.post(API_ENDPOINTS.ROOMS.CREATE_BUILDING, payload);
  },
  // end add building management api calls
};
