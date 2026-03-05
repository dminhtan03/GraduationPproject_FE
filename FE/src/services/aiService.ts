// ===== AI ASSISTANT SERVICE =====

import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import type { AiChatRequestDto, AiChatResponseDto } from "../types/api";

export const aiService = {
  async chat(payload: AiChatRequestDto): Promise<AiChatResponseDto> {
    const res = await api.post<unknown>(API_ENDPOINTS.AI.CHAT, payload);
    const payloadData =
      (res.data as { data?: AiChatResponseDto }).data ??
      (res.data as AiChatResponseDto);
    return payloadData;
  },

  async reserve(payload: {
    roomId: string;
    startTime: string;
    endTime: string;
    purpose?: string;
    attendeeCount?: number;
  }): Promise<AiChatResponseDto> {
    const res = await api.post<unknown>(API_ENDPOINTS.AI.RESERVE, payload);
    const payloadData =
      (res.data as { data?: AiChatResponseDto }).data ??
      (res.data as AiChatResponseDto);
    return payloadData;
  },
};
