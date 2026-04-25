// ===== AI Chat Types =====
import type { AiChatResponseDto, AiRoomSuggestion } from "./api";
import type { Reservation } from ".";

export type Sender = "user" | "bot";

export interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
  suggestions?: AiRoomSuggestion[];
  roomDetail?: AiChatResponseDto["roomDetail"];
  reservation?: Reservation | null;
  reservationCreated?: boolean;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  aiSessionId?: string;
}
