// ===== AI Chat Helper Functions =====
import type {
  AiChatHistoryDetailMessageDto,
  AiChatHistorySummaryDto,
} from "../services/aiService";
import type { Reservation } from "../types";
import type {
  ChatMessage,
  ChatSessionSummary,
  Sender,
} from "../types/chat";
import type { SpeechRecognitionCtor } from "../types/speech.d";

// ── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_CHAT_TITLE = "New Conversation";
export const DEFAULT_CHAT_SUBTITLE = "Start chatting with UniBot";

// ── Primitive coercions ───────────────────────────────────────────────────────

export const toText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const toPositiveNumber = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

export const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

export const toNumberOrNull = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

// ── ID & date helpers ─────────────────────────────────────────────────────────

export const createId = () => Math.random().toString(36).slice(2);

export const formatClock = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

export const formatDateTimeLabel = (value: unknown) => {
  if (!value) return "-";

  const raw = String(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ── Session title / subtitle helpers ─────────────────────────────────────────

export const toSessionTitle = (value: string) => {
  const content = value.trim();
  if (!content) return DEFAULT_CHAT_TITLE;
  return content.slice(0, 36) + (content.length > 36 ? "..." : "");
};

export const toSessionSubtitle = (value: string) => {
  const content = value.trim();
  return content || DEFAULT_CHAT_SUBTITLE;
};

// ── Message factories ─────────────────────────────────────────────────────────

export const createWelcomeMessage = (): ChatMessage => ({
  id: createId(),
  sender: "bot",
  text: "Hello, I am UniBot. I can help you find available rooms, check capacity, and book quickly.",
  createdAt: new Date().toISOString(),
});

// ── History mappers ───────────────────────────────────────────────────────────

export const mapHistorySender = (sender: string): Sender =>
  sender.toUpperCase() === "USER" ? "user" : "bot";

export const mapDetailMessageToChatMessage = (
  message: AiChatHistoryDetailMessageDto,
): ChatMessage | null => {
  const text = toText(message.message);
  if (!text) return null;

  return {
    id: message.id || createId(),
    sender: mapHistorySender(message.sender),
    text,
    createdAt: message.createdAt || new Date().toISOString(),
  };
};

export const mapHistorySessionToSummary = (
  session: AiChatHistorySummaryDto,
): ChatSessionSummary => {
  const lastMessage = toText(session.lastMessage);
  return {
    id: session.sessionId,
    title: toSessionTitle(lastMessage),
    subtitle: toSessionSubtitle(lastMessage),
    createdAt:
      session.startedAt || session.lastMessageAt || new Date().toISOString(),
    aiSessionId: session.sessionId,
  };
};

// ── Style helpers ─────────────────────────────────────────────────────────────

export const statusClass: Record<string, string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-100 text-emerald-700",
  RESERVED: "border-emerald-200 bg-emerald-100 text-emerald-700",
};

export const bookingStatusClass = (status: string) => {
  const upper = status.toUpperCase();
  if (
    upper === "APPROVED" ||
    upper === "CHECKED_IN" ||
    upper === "IN_USE" ||
    upper === "RESERVED"
  ) {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  if (upper === "CANCELLED" || upper === "REJECTED") {
    return "border-rose-200 bg-rose-100 text-rose-700";
  }
  if (upper === "COMPLETED") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  return "border-amber-200 bg-amber-100 text-amber-700";
};

// ── Booking card data extractor ───────────────────────────────────────────────

export const getBookingCardData = (reservation?: Reservation | null) => {
  if (!reservation) return null;

  const source = toRecord(reservation);
  if (!source) return null;

  const room = toRecord(source.room);
  const floor = toRecord(source.floor);
  const building = toRecord(source.building);

  const id = toText(source.id) || "-";
  const roomCode =
    toText(source.locationCode) ||
    toText(room?.locationCode) ||
    toText(room?.roomName) ||
    toText(source.roomId) ||
    "-";
  const floorName =
    toText(source.floor) ||
    toText(floor?.name) ||
    toText(floor?.floorName) ||
    "-";
  const buildingName =
    toText(source.buildingName) ||
    toText(building?.name) ||
    toText(building?.buildingName) ||
    "-";
  const purpose = toText(source.purpose) || "-";
  const note = toText(source.note);
  const status = toText(source.status) || "PENDING";
  const attendeeCount = toNumberOrNull(source.attendeeCount);

  return {
    id,
    roomCode,
    floorName,
    buildingName,
    startTime: formatDateTimeLabel(source.startTime),
    endTime: formatDateTimeLabel(source.endTime),
    purpose,
    note,
    status,
    attendeeCount,
  };
};

// ── Speech Recognition ────────────────────────────────────────────────────────

export const getSpeechRecognitionCtor = () => {
  const maybeWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return maybeWindow.SpeechRecognition || maybeWindow.webkitSpeechRecognition;
};
