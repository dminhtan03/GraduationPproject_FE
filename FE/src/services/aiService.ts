// ===== AI ASSISTANT SERVICE =====

import { api } from "./api";
import { API_ENDPOINTS, buildUrl } from "../constants/endpoints";
import type { AiChatRequestDto, AiChatResponseDto } from "../types/api";

export interface AiChatHistorySummaryDto {
  sessionId: string;
  messageCount: number;
  startedAt: string;
  lastMessageAt: string;
  lastSender: string;
  lastMessage: string;
}

export interface AiChatHistoryDetailMessageDto {
  id: string;
  sender: string;
  message: string;
  createdAt: string;
}

export interface AiChatHistoryDetailDto extends AiChatHistorySummaryDto {
  messages: AiChatHistoryDetailMessageDto[];
}

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
  intent?: string;
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
  menuOptions?: Array<{
    code?: string;
    label?: string;
    intent?: string;
  }>;
  reservationCreated?: boolean;
  reservation?: AiChatResponseDto["reservation"];
  roomDetail?: {
    id?: string;
    locationCode?: string;
    capacity?: number | null;
    score?: number | null;
    currentUserId?: string;
    currentUserName?: string;
    checkInTime?: string;
    amenities?: Array<{ name?: string } | string>;
    images?: Array<{ imageUrl?: string } | string>;
    feedbacks?: Array<{
      id?: string;
      rating?: number | null;
      description?: string;
      createdAt?: string;
    }>;
  };
  availableRooms?: BackendChatbotRoomItem[];
  alternativeRooms?: BackendChatbotRoomItem[];
};

type BackendChatHistorySummary = {
  sessionId?: string;
  messageCount?: number;
  startedAt?: string;
  lastMessageAt?: string;
  lastSender?: string;
  lastMessage?: string;
};

type BackendChatHistoryDetailMessage = {
  id?: string;
  sender?: string;
  message?: string;
  createdAt?: string;
};

type BackendChatHistoryDetail = BackendChatHistorySummary & {
  messages?: BackendChatHistoryDetailMessage[];
};

const unwrapData = <T>(value: unknown): T => {
  return ((value as { data?: T })?.data ?? value) as T;
};

const normalizeHistorySummary = (
  item: BackendChatHistorySummary,
): AiChatHistorySummaryDto | null => {
  const sessionId =
    typeof item.sessionId === "string" ? item.sessionId.trim() : "";
  if (!sessionId) return null;

  return {
    sessionId,
    messageCount: Number(item.messageCount ?? 0),
    startedAt: item.startedAt || item.lastMessageAt || new Date().toISOString(),
    lastMessageAt:
      item.lastMessageAt || item.startedAt || new Date().toISOString(),
    lastSender: item.lastSender || "BOT",
    lastMessage: item.lastMessage || "",
  };
};

const normalizeHistoryDetail = (
  item: BackendChatHistoryDetail,
): AiChatHistoryDetailDto => {
  const summary = normalizeHistorySummary(item) ?? {
    sessionId: "",
    messageCount: 0,
    startedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    lastSender: "BOT",
    lastMessage: "",
  };

  const messages = Array.isArray(item.messages)
    ? item.messages
        .filter((message) => typeof message?.message === "string")
        .map((message) => ({
          id:
            (typeof message.id === "string" && message.id) ||
            Math.random().toString(36).slice(2),
          sender: message.sender || "BOT",
          message: message.message || "",
          createdAt: message.createdAt || new Date().toISOString(),
        }))
    : [];

  return {
    ...summary,
    messages,
  };
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
  const suggestionType =
    raw.alternativeRooms && raw.alternativeRooms.length > 0
      ? "alternative"
      : raw.availableRooms && raw.availableRooms.length > 0
        ? "available"
        : raw.suggestions && raw.suggestions.length > 0
          ? "suggested"
          : undefined;
  const roomDetail = raw.roomDetail
    ? {
        id: raw.roomDetail.id,
        locationCode: raw.roomDetail.locationCode,
        capacity: raw.roomDetail.capacity ?? null,
        score: raw.roomDetail.score ?? null,
        currentUserId: raw.roomDetail.currentUserId,
        currentUserName: raw.roomDetail.currentUserName,
        checkInTime: raw.roomDetail.checkInTime,
        amenities: Array.isArray(raw.roomDetail.amenities)
          ? raw.roomDetail.amenities
              .map((item) =>
                typeof item === "string" ? item : (item?.name ?? ""),
              )
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        images: Array.isArray(raw.roomDetail.images)
          ? raw.roomDetail.images
              .map((item) =>
                typeof item === "string" ? item : (item?.imageUrl ?? ""),
              )
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        feedbacks: Array.isArray(raw.roomDetail.feedbacks)
          ? raw.roomDetail.feedbacks.map((item) => ({
              id: item.id,
              rating:
                typeof item.rating === "number" && Number.isFinite(item.rating)
                  ? item.rating
                  : null,
              description: item.description || "",
              createdAt: item.createdAt,
            }))
          : [],
      }
    : null;

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

  const menuOptions =
    Array.isArray(raw.menuOptions) && raw.menuOptions.length > 0
      ? raw.menuOptions
          .filter((item) => item.code || item.label)
          .map((item) => ({
            code: item.code || "",
            label: item.label || "",
            intent: item.intent || "",
          }))
      : undefined;

  return {
    sessionId: raw.sessionId,
    reply: raw.reply || "I could not generate a response. Please try again.",
    intent: raw.intent,
    suggestionType,
    suggestions: mappedSuggestions,
    menuOptions,
    roomDetail,
    reservationCreated: raw.reservationCreated ?? Boolean(raw.reservation),
    reservation: raw.reservation ?? null,
  };
};

export const aiService = {
  async addChat(): Promise<string> {
    const res = await api.post<unknown>(API_ENDPOINTS.AI.ADD_CHAT);
    const payloadData = unwrapData<{ sessionId?: string }>(res.data);
    const sessionId = payloadData?.sessionId;

    if (!sessionId) {
      throw new Error("Failed to create chat session");
    }

    return sessionId;
  },

  async chat(payload: AiChatRequestDto): Promise<AiChatResponseDto> {
    const res = await api.post<unknown>(API_ENDPOINTS.AI.CHAT, payload);
    const payloadData = unwrapData<BackendChatbotResponse>(res.data);
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
    const payloadData = unwrapData<BackendChatbotResponse>(res.data);
    return normalizeChatResponse(payloadData);
  },

  async getChatHistory(): Promise<AiChatHistorySummaryDto[]> {
    const res = await api.get<unknown>(API_ENDPOINTS.AI.HISTORY);
    const payloadData = unwrapData<BackendChatHistorySummary[]>(res.data);

    if (!Array.isArray(payloadData)) {
      return [];
    }

    return payloadData
      .map((item) => normalizeHistorySummary(item))
      .filter((item): item is AiChatHistorySummaryDto => item !== null);
  },

  async getChatHistoryDetail(
    sessionId: string,
  ): Promise<AiChatHistoryDetailDto> {
    const res = await api.get<unknown>(
      buildUrl(API_ENDPOINTS.AI.HISTORY_DETAIL, { sessionId }),
    );
    const payloadData = unwrapData<BackendChatHistoryDetail>(res.data);
    return normalizeHistoryDetail(payloadData);
  },

  async deleteChat(
    sessionId: string,
  ): Promise<{ sessionId: string; deletedMessages: number; message?: string }> {
    const res = await api.delete<unknown>(
      buildUrl(API_ENDPOINTS.AI.DELETE_CHAT, { sessionId }),
    );
    const payloadData = unwrapData<unknown>(res.data);
    const deletedMessages =
      typeof payloadData === "number"
        ? payloadData
        : Number(
            (payloadData as { deletedMessages?: unknown } | null)
              ?.deletedMessages ?? 0,
          );
    return {
      sessionId,
      deletedMessages,
    };
  },

  async reserve(payload: {
    roomId: string;
    startTime: string;
    endTime: string;
    purpose?: string;
    attendeeCount?: number;
  }): Promise<AiChatResponseDto> {
    const res = await api.post<unknown>(API_ENDPOINTS.AI.RESERVE, payload);
    const payloadData = unwrapData<AiChatResponseDto>(res.data);
    return payloadData;
  },
};
