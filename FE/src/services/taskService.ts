import { api } from "./api";

const BASE = "/api/v1/tasks";

const extractData = (res: any) => res?.data?.data ?? res?.data ?? res;

export const taskService = {
  // ── CRUD ──────────────────────────────────────────────────────────────────
  createTask: async (payload: Record<string, any>) => {
    const res = await api.post(BASE, payload);
    return extractData(res);
  },

  getTask: async (taskId: string) => {
    const res = await api.get(`${BASE}/${taskId}`);
    return extractData(res);
  },

  updateTask: async (taskId: string, payload: Record<string, any>) => {
    const res = await api.put(`${BASE}/${taskId}`, payload);
    return extractData(res);
  },

  deleteTask: async (taskId: string) => {
    await api.delete(`${BASE}/${taskId}`);
  },

  cancelTask: async (taskId: string) => {
    const res = await api.patch(`${BASE}/${taskId}/cancel`);
    return extractData(res);
  },

  // ── Listing ───────────────────────────────────────────────────────────────
  listMyTasks: async (type?: string) => {
    const res = await api.get(BASE, { params: type ? { type } : undefined });
    const data = extractData(res);
    return Array.isArray(data) ? data : [];
  },

  listAssignedToMe: async () => {
    const res = await api.get(`${BASE}/assigned-to-me`);
    const data = extractData(res);
    return Array.isArray(data) ? data : [];
  },

  listPendingAssignments: async () => {
    const res = await api.get(`${BASE}/pending-assignments`);
    const data = extractData(res);
    return Array.isArray(data) ? data : [];
  },

  listPendingApprovals: async () => {
    const res = await api.get(`${BASE}/pending-approvals`);
    const data = extractData(res);
    return Array.isArray(data) ? data : [];
  },

  getTodaySummary: async () => {
    const res = await api.get(`${BASE}/summary/today`);
    return extractData(res);
  },

  // ── Status ────────────────────────────────────────────────────────────────
  changeStatus: async (taskId: string, status: string) => {
    const res = await api.patch(`${BASE}/${taskId}/status`, { status });
    return extractData(res);
  },

  submitForReview: async (taskId: string, resultNote: string) => {
    const res = await api.post(`${BASE}/${taskId}/submit`, { resultNote });
    return extractData(res);
  },

  reviewTask: async (taskId: string, decision: "APPROVED" | "REJECTED", comment?: string) => {
    const res = await api.post(`${BASE}/${taskId}/review`, { decision, comment });
    return extractData(res);
  },

  // ── Assignment ────────────────────────────────────────────────────────────
  assignTask: async (
    taskId: string,
    payload: { assigneeId: string; brief?: string; how?: string; primary?: boolean; requireApproval?: boolean }
  ) => {
    const res = await api.post(`${BASE}/${taskId}/assign`, {
      assigneeId: payload.assigneeId,
      brief: payload.brief,
      how: payload.how,
      primary: payload.primary ?? true,
      requireApproval: payload.requireApproval ?? false,
    });
    return extractData(res);
  },

  respondToAssignment: async (taskId: string, assignmentId: string, response: "ACCEPT" | "REJECT") => {
    const res = await api.post(`${BASE}/${taskId}/assignments/${assignmentId}/respond`, { response });
    return extractData(res);
  },

  approveAssignment: async (taskId: string, assignmentId: string) => {
    const res = await api.post(`${BASE}/${taskId}/assignments/${assignmentId}/approve`);
    return extractData(res);
  },

  // ── Reviewer ─────────────────────────────────────────────────────────────
  inviteReviewer: async (taskId: string, reviewerUserId: string) => {
    const res = await api.post(`${BASE}/${taskId}/reviewer`, { reviewerUserId });
    return extractData(res);
  },

  respondReviewerInvite: async (taskId: string, response: "ACCEPT" | "REJECT") => {
    const res = await api.post(`${BASE}/${taskId}/reviewer/respond`, { response });
    return extractData(res);
  },

  // ── Supporter ─────────────────────────────────────────────────────────────
  addSupporter: async (taskId: string, userId: string) => {
    const res = await api.post(`${BASE}/${taskId}/supporters`, { userId });
    return extractData(res);
  },

  respondSupporterInvite: async (taskId: string, supporterId: string, response: "ACCEPT" | "REJECT") => {
    const res = await api.post(`${BASE}/${taskId}/supporters/${supporterId}/respond`, { response });
    return extractData(res);
  },
};
