import axios from "axios";
import { api } from "./api";

const BASE = "/api/v1/meetings";
const DRAFTS = "/api/v1/assignment-drafts";

const extractData = (res: any) => res?.data?.data ?? res?.data ?? res;

export const meetingService = {
  createMeeting: async (payload: { title: string; reservationId?: string; language?: string }) => {
    const res = await api.post(BASE, {
      title: payload.title,
      reservation_id: payload.reservationId,
      language: payload.language ?? "vi",
    });
    return extractData(res);
  },

  listMeetings: async () => {
    const res = await api.get(BASE);
    const data = extractData(res);
    return Array.isArray(data) ? data : [];
  },

  getMeeting: async (meetingId: string) => {
    const res = await api.get(`${BASE}/${meetingId}`);
    return extractData(res);
  },

  uploadRecording: async (meetingId: string, filePath: string) => {
    const res = await api.post(`${BASE}/${meetingId}/recording`, { file_path: filePath });
    return extractData(res);
  },

  aiExtractAssignments: async (meetingId: string, audioPath?: string) => {
    const res = await api.post(`${BASE}/${meetingId}/ai-extract-assignments`,
      audioPath ? { audio_path: audioPath } : {});
    return extractData(res);
  },

  listDrafts: async (meetingId: string) => {
    const res = await api.get(`${BASE}/${meetingId}/assignment-drafts`);
    const data = extractData(res);
    return Array.isArray(data) ? data : [];
  },

  updateDraft: async (draftId: string, payload: { assignerUserId?: string; assigneeUserId?: string }) => {
    const res = await api.patch(`${DRAFTS}/${draftId}`, {
      assigner_user_id: payload.assignerUserId,
      assignee_user_id: payload.assigneeUserId,
    });
    return extractData(res);
  },

  getMeetingByReservation: async (reservationId: string) => {
    const res = await api.get(`/api/v1/meetings/by-reservation/${reservationId}`);
    return extractData(res) as {
      meetingId: string;
      title: string;
      summary: string;
      transcript: string;
      status: string;
      createdAt: string;
      hasAudio: boolean;
      tasks: {
        draftId: string;
        title: string;
        description: string;
        priority: string;
        dueAt: string;
        aiConfidence: number;
        createdTaskId: string | null;
      }[];
    } | null;
  },

  getAudioBlob: async (meetingId: string): Promise<{ blob: Blob; url: string } | null> => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const token = localStorage.getItem("user_token") ?? "";
      const res = await axios.get(`${baseURL}/api/v1/meetings/${meetingId}/audio`, {
        responseType: "blob",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        withCredentials: true,
      });
      const blob = res.data as Blob;
      return { blob, url: URL.createObjectURL(blob) };
    } catch {
      return null;
    }
  },

  approveDraft: async (draftId: string, taskId?: string) => {
    const res = await api.post(`${DRAFTS}/${draftId}/approve`,
      taskId ? { taskId } : undefined);
    return extractData(res);
  },

  processRecording: async (
    audioBlob: Blob,
    reservationId: string,
    title?: string,
    onProgress?: (pct: number) => void,
  ) => {
    const form = new FormData();
    const ext = audioBlob.type.includes("ogg") ? ".ogg" : ".webm";
    form.append("audio", audioBlob, `recording${ext}`);
    form.append("reservationId", reservationId);
    if (title) form.append("title", title);

    // Fresh axios instance — no inherited Content-Type: application/json default.
    // Browser XHR automatically sets Content-Type: multipart/form-data; boundary=... for FormData.
    const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const token = localStorage.getItem("user_token") ?? "";
    const res = await axios.post(`${baseURL}${BASE}/process-recording`, form, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // intentionally NO Content-Type → browser sets multipart boundary automatically
      },
      withCredentials: true,
      onUploadProgress: (e: any) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return extractData(res) as {
      meetingId: string;
      summary: string;
      transcript: string;
      tasks: { title: string; description: string; priority: string; dueAt: string; aiConfidence: number }[];
    };
  },
};
