import type { AiMenuOption } from "../types/api";
import type { UserProfile } from "../types";
import type { ChatMessage, ChatSessionSummary } from "../types/chat";
import {
  AI_ASSISTANT_STORAGE_KEY,
  AI_ASSISTANT_GUEST_KEY,
  BOOKING_CAPACITY_OPTIONS,
  QUICK_ACTION_LABELS,
} from "../constants/aiAssistant";
import {
  DEFAULT_CHAT_SUBTITLE,
  DEFAULT_CHAT_TITLE,
  toSessionSubtitle,
  toSessionTitle,
  toText,
} from "./chatHelpers";

export interface StoredAssistantState {
  messagesBySession: Record<string, ChatMessage[]>;
  selectedSessionId: string | null;
}

export const resolveQuickActionLabel = (option: AiMenuOption) =>
  QUICK_ACTION_LABELS[option.intent] || option.label;

export const buildAssistantStorageKey = (profile: UserProfile | null) => {
  const rawKey = profile?.id || profile?.email || AI_ASSISTANT_GUEST_KEY;
  const normalizedKey = String(rawKey || AI_ASSISTANT_GUEST_KEY)
    .trim()
    .toLowerCase();
  return `${AI_ASSISTANT_STORAGE_KEY}:${normalizedKey || AI_ASSISTANT_GUEST_KEY}`;
};

const formatHourMinute = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;

const hashSeed = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash;
};

const buildRandomTime = (seed: string, fallback: string) => {
  const hourSeed = hashSeed(`${seed}:h`);
  const minuteSeed = hashSeed(`${seed}:m`);
  const hour = 8 + (hourSeed % 12);
  const minute = minuteSeed % 2 === 0 ? 0 : 30;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )}`;
  if (value === fallback) {
    const bumpedHour = hour >= 19 ? 8 : hour + 1;
    return `${String(bumpedHour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )}`;
  }
  return value;
};

export const buildBookingTimeOptions = (seed: string) => {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() + 1);
  const baseTime = formatHourMinute(base);
  const nowTime = formatHourMinute(new Date());

  const buildOption = (
    label: string,
    offsetDays: number,
    timeLabel: string,
  ) => {
    const date = new Date(base);
    date.setDate(date.getDate() + offsetDays);

    return {
      label: `${label} ${timeLabel}`,
      message: `${label} lúc ${timeLabel}`,
    };
  };

  const randomTimeToday = buildRandomTime(`${seed}-today`, baseTime);
  const randomTimeOther = buildRandomTime(`${seed}-other`, baseTime);
  const randomTimeExtra = buildRandomTime(`${seed}-extra`, baseTime);
  const extraTime =
    randomTimeExtra === nowTime
      ? buildRandomTime(`${seed}-extra-alt`, baseTime)
      : randomTimeExtra;

  return [
    buildOption("Hôm nay", 0, nowTime),
    buildOption("Hôm nay", 0, baseTime),
    buildOption("Ngày mai", 1, baseTime),
    buildOption("Hôm nay", 0, randomTimeToday),
    buildOption("Ngày kia", 2, randomTimeOther),
    buildOption("Ngày mai", 0, extraTime),
  ];
};

export const buildCapacityOptions = (capacity?: number) => {
  const maxCap =
    typeof capacity === "number" && Number.isFinite(capacity) && capacity > 0
      ? Math.round(capacity)
      : 0;
  if (!maxCap) return BOOKING_CAPACITY_OPTIONS;

  const step = Math.max(1, Math.round(maxCap / 4));
  const rawValues = [step, step * 2, step * 3, maxCap];
  const values = Array.from(
    new Set(rawValues.filter((value) => value > 0 && value <= maxCap)),
  );

  return values.map((people) => ({
    label: `${people} người`,
    message: `${people} người`,
  }));
};

export const resolveBookingRoomCode = (item: {
  roomCode?: string;
  label?: string;
}) => {
  const direct = item.roomCode?.trim();
  if (direct) return direct;

  const label = item.label || "";
  const leftPart = label.split("|")[0] || "";
  return leftPart.replace(/^\s*\d+\.?\s*/, "").trim();
};

const isMessageArrayRecord = (
  value: unknown,
): value is Record<string, ChatMessage[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((entry) =>
    Array.isArray(entry),
  );
};

export const getStoredAssistantState = (
  storageKey: string,
): StoredAssistantState | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (isMessageArrayRecord(parsed)) {
      return {
        messagesBySession: parsed,
        selectedSessionId: null,
      };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as {
      messagesBySession?: unknown;
      selectedSessionId?: unknown;
      messages?: unknown;
    };

    const messagesBySession = candidate.messagesBySession ?? candidate.messages;
    if (!isMessageArrayRecord(messagesBySession)) {
      return null;
    }

    return {
      messagesBySession,
      selectedSessionId:
        typeof candidate.selectedSessionId === "string" &&
        candidate.selectedSessionId.trim()
          ? candidate.selectedSessionId.trim()
          : null,
    };
  } catch {
    return null;
  }
};

export const deriveStoredSessions = (
  messagesBySession: Record<string, ChatMessage[]>,
): ChatSessionSummary[] =>
  Object.entries(messagesBySession)
    .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
    .map(([sessionId, messages]) => {
      const lastMessage = messages[messages.length - 1];
      const lastText = toText(lastMessage?.text);

      return {
        id: sessionId,
        title: toSessionTitle(lastText) || DEFAULT_CHAT_TITLE,
        subtitle: toSessionSubtitle(lastText) || DEFAULT_CHAT_SUBTITLE,
        createdAt: messages[0]?.createdAt || new Date().toISOString(),
        aiSessionId: sessionId,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

export const mergeSessionsById = (
  primarySessions: ChatSessionSummary[],
  secondarySessions: ChatSessionSummary[],
): ChatSessionSummary[] => {
  const merged = [...primarySessions];
  const knownIds = new Set(primarySessions.map((session) => session.id));

  for (const session of secondarySessions) {
    if (!knownIds.has(session.id)) {
      merged.push(session);
    }
  }

  return merged.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
};

export const CAPACITY_RANGE_OPTIONS = [
  { id: "CAP_5_20", label: "5 - 20 người", message: "5 - 20 người" },
  { id: "CAP_20_40", label: "20 - 40 người", message: "20 - 40 người" },
  { id: "CAP_40_60", label: "40 - 60 người", message: "40 - 60 người" },
  { id: "CAP_60_80", label: "60 - 80 người", message: "60 - 80 người" },
  { id: "CAP_80_100", label: "80 - 100 người", message: "80 - 100 người" },
];

export type BookingTimeMode = "quick" | "manual";

export type BookingTimeUiState = {
  mode: BookingTimeMode;
  dayIndex: number;
  time: string;
  manualMessage: string;
  durationMinutes?: number;
};

export type BookingDayOption = {
  id: string;
  label: string;
  dateLabel: string;
  offsetDays: number;
};

export const BOOKING_TIME_SLOTS = Array.from({ length: 30 }, (_, index) => {
  const baseMinutes = 7 * 60;
  const minutes = baseMinutes + index * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

export const formatBookingDateLabel = (date: Date) =>
  date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });

export const buildBookingDayOptions = (base: Date): BookingDayOption[] => {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);

  return ["Hôm nay", "Ngày mai", "Ngày kia"].map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      id: `DAY_${index}`,
      label,
      dateLabel: formatBookingDateLabel(date),
      offsetDays: index,
    };
  });
};

export const timeLabelToMinutes = (label: string) => {
  const [hourText, minuteText] = label.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return hour * 60 + minute;
};

export const roundToNextHalfHour = (date: Date) => {
  const next = new Date(date);
  next.setSeconds(0, 0);

  const minutes = next.getMinutes();
  const remainder = minutes % 30;
  if (remainder !== 0) {
    next.setMinutes(minutes + (30 - remainder));
  }

  return next;
};

export const getAvailableTimeSlots = (offsetDays: number, now: Date) => {
  if (offsetDays !== 0) return BOOKING_TIME_SLOTS;

  const nextSlot = roundToNextHalfHour(now);
  const minMinutes = nextSlot.getHours() * 60 + nextSlot.getMinutes();

  return BOOKING_TIME_SLOTS.filter(
    (label) => timeLabelToMinutes(label) >= minMinutes,
  );
};

