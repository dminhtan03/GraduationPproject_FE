import { api } from "./api";

const BASE = "/api/v1/projects";
const extractData = (res: any) => res?.data?.data ?? res?.data ?? res;

export const projectService = {
  createProject: async (payload: {
    name: string; description?: string; goal?: string;
    startDate?: string; endDate?: string; memberIds?: string[];
  }) => {
    const res = await api.post(BASE, payload);
    return extractData(res);
  },

  listProjects: async () => {
    const res = await api.get(BASE);
    const data = extractData(res);
    return Array.isArray(data) ? data : [];
  },

  getProject: async (projectId: string) => {
    const res = await api.get(`${BASE}/${projectId}`);
    return extractData(res);
  },

  updateProject: async (projectId: string, payload: Record<string, any>) => {
    const res = await api.put(`${BASE}/${projectId}`, payload);
    return extractData(res);
  },

  deleteProject: async (projectId: string) => {
    await api.delete(`${BASE}/${projectId}`);
  },

  addMember: async (projectId: string, userId: string) => {
    const res = await api.post(`${BASE}/${projectId}/members`, { userId });
    return extractData(res);
  },

  removeMember: async (projectId: string, userId: string) => {
    await api.delete(`${BASE}/${projectId}/members/${userId}`);
  },
};
