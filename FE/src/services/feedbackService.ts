import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";

export interface CreateFeedbackRequest {
  reservationId: string;
  rating: number;
  description: string;
  createdAt?: string;
}

export const feedbackService = {
  async createFeedback(payload: CreateFeedbackRequest) {
    return api.post(API_ENDPOINTS.FEEDBACK.CREATE, payload);
  },
};
