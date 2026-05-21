import { api } from "./api";

const extractData = (res: any) => res?.data?.data ?? res?.data ?? res;

let cachedMe: { id: string; email: string; fullName: string } | null = null;

export const userService = {
  getMe: async () => {
    if (cachedMe) return cachedMe;
    const res = await api.get("/api/v1/user/me");
    cachedMe = extractData(res) as { id: string; email: string; fullName: string };
    return cachedMe;
  },

  clearCache: () => { cachedMe = null; },

  searchUsers: async (q: string) => {
    const res = await api.get("/api/v1/users", { params: { q } });
    const data = extractData(res);
    return Array.isArray(data) ? data as { id: string; fullName: string; email: string }[] : [];
  },
};
