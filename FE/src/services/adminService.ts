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

  async lockUser(userId: string): Promise<void> {
    await api.put(buildUrl(API_ENDPOINTS.DASHBOARD.LOCK_USER, { userId }));
  },

  async unlockUser(userId: string): Promise<void> {
    await api.put(buildUrl(API_ENDPOINTS.DASHBOARD.UNLOCK_USER, { userId }));
  },
};
