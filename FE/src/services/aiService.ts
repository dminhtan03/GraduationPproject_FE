// ===== AI ASSISTANT SERVICE =====

import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import type { AiChatRequestDto, AiChatResponseDto } from "../types/api";

type BackendChatbotRoomItem = {
  id?: string;
  roomId?: string;
  roomID?: string;
  room_id?: string;
  roomCode?: string;
  locationCode?: string;
  status?: string;
  score?: number | null;
  building?: string;
  floor?: string;
  capacity?: number | null;
  amenities?: string[];
  imageUrl?: string;
  availableTimeSlots?: string[];
};

type BackendChatbotResponse = {
  sessionId?: string;
  reply?: string;
  suggestions?: Array<{
    roomId?: string;
    locationCode?: string;
    score?: number | null;
    status?: string;
    building?: string;
    floor?: string;
    capacity?: number | null;
    amenities?: string[];
    imageUrl?: string;
    availableTimeSlots?: string[];
  }>;
  reservationCreated?: boolean;
  reservation?: AiChatResponseDto["reservation"];
  availableRooms?: BackendChatbotRoomItem[];
  alternativeRooms?: BackendChatbotRoomItem[];
};

const mapRoomsToSuggestions = (rooms?: BackendChatbotRoomItem[]) => {
  if (!rooms || rooms.length === 0) return [];

  const pickRoomId = (item: BackendChatbotRoomItem) => {
    return item.roomId || item.roomID || item.room_id || item.id || "";
  };

  return rooms
    .filter(
      (item) =>
        item.roomId ||
        item.roomID ||
        item.room_id ||
        item.id ||
        item.roomCode ||
        item.locationCode,
    )
    .map((item) => ({
      roomId: pickRoomId(item),
      locationCode:
        item.locationCode || item.roomCode || pickRoomId(item) || "",
      score: item.score ?? null,
      status: item.status || "AVAILABLE",
      building: item.building,
      floor: item.floor,
      capacity: item.capacity,
      amenities: item.amenities,
      imageUrl: item.imageUrl,
      availableTimeSlots: item.availableTimeSlots,
    }));
};

const normalizeChatResponse = (
  raw: BackendChatbotResponse,
): AiChatResponseDto => {
  const mappedSuggestions =
    raw.suggestions && raw.suggestions.length > 0
      ? raw.suggestions.map((item) => ({
          roomId: item.roomId || "",
          locationCode: item.locationCode || item.roomId || "",
          score: item.score ?? null,
          status: item.status || "AVAILABLE",
          building: item.building,
          floor: item.floor,
          capacity: item.capacity,
          amenities: item.amenities,
          imageUrl: item.imageUrl,
          availableTimeSlots: item.availableTimeSlots,
        }))
      : [
          ...mapRoomsToSuggestions(raw.availableRooms),
          ...mapRoomsToSuggestions(raw.alternativeRooms),
        ];

  return {
    sessionId: raw.sessionId,
    reply: raw.reply || "I could not generate a response. Please try again.",
    suggestions: mappedSuggestions,
    reservationCreated: raw.reservationCreated ?? Boolean(raw.reservation),
    reservation: raw.reservation ?? null,
  };
};

export const aiService = {
  async chat(payload: AiChatRequestDto): Promise<AiChatResponseDto> {
    const res = await api.post<unknown>(API_ENDPOINTS.AI.CHAT, payload);
    const payloadData =
      (res.data as { data?: BackendChatbotResponse }).data ??
      (res.data as BackendChatbotResponse);
    return normalizeChatResponse(payloadData);
  },

  async voice(payload: {
    transcript: string;
    sessionId?: string;
    language?: string;
  }): Promise<AiChatResponseDto> {
    const formData = new FormData();
    formData.append("transcript", payload.transcript);

    if (payload.sessionId) {
      formData.append("sessionId", payload.sessionId);
    }

    if (payload.language) {
      formData.append("language", payload.language);
    }

    const res = await api.post<unknown>(API_ENDPOINTS.AI.VOICE, formData);
    const payloadData =
      (res.data as { data?: BackendChatbotResponse }).data ??
      (res.data as BackendChatbotResponse);
    return normalizeChatResponse(payloadData);
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
