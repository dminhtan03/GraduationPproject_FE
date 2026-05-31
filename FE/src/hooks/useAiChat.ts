import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { aiService } from "../services/aiService";
import { api } from "../services/api";
import { API_ENDPOINTS } from "../constants/endpoints";
import { ROUTES } from "../constants";
import { roomService } from "../services/roomService";
import { extractApiMessage } from "../utils/errorHandlers";
import {
  createId,
  toText,
  toPositiveNumber,
  toRecord,
  getBookingCardData,
  bookingStatusClass,
  formatDateTimeLabel,
  toNumberOrNull,
} from "../utils/chatHelpers";
import type {
  AiChatResponseDto,
  AiMenuOption,
  AiRoomSuggestion,
} from "../types/api";
import type { Reservation, UserProfile } from "../types";
import {
  resolveBookingRoomCode,
  resolveQuickActionLabel,
  CAPACITY_RANGE_OPTIONS,
  type BookingTimeMode,
  type BookingTimeUiState,
  buildBookingDayOptions,
  getAvailableTimeSlots,
} from "../utils/aiAssistant";
import { normalizeRoomsMap } from "../utils/roomList";

// ── Local types ───────────────────────────────────────────────────────────────

export type Sender = "user" | "bot";

export interface ChatBubbleMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
  intent?: AiChatResponseDto["intent"];
  suggestionType?: AiChatResponseDto["suggestionType"];
  suggestions?: AiRoomSuggestion[];
  menuOptions?: AiMenuOption[];
  reservation?: Reservation | null;
  reservationCreated?: boolean;
  roomDetail?: Record<string, unknown> | null;
  bookingItems?: any[];
}

interface StoredWidgetState {
  messages: ChatBubbleMessage[];
  aiSessionId: string | null;
  hasGreeted: boolean;
}

const WIDGET_STORAGE_KEY = "ai_widget_chat_state_v1";

// ── Default fallback quick‐action menu ────────────────────────────────────────

const DEFAULT_MENU_OPTIONS: AiMenuOption[] = [
  { code: "1", label: "Đặt phòng", intent: "BOOK_ROOM" },
  { code: "2", label: "Hủy phòng", intent: "CANCEL_RESERVATION" },
  { code: "3", label: "Gia hạn thời gian", intent: "EXTEND_RESERVATION" },
  { code: "4", label: "Tra cứu", intent: "LOOKUP" },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAiChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeMenuOptions, setActiveMenuOptions] = useState<AiMenuOption[]>(
    [],
  );
  const [dismissedSuggestionMessageId, setDismissedSuggestionMessageId] =
    useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // New States and Memos for AIAssistant equivalent features
  const [bookingImageByCode, setBookingImageByCode] = useState<
    Record<string, string>
  >({});
  const [bookingTimeUiByMessage, setBookingTimeUiByMessage] = useState<
    Record<string, BookingTimeUiState>
  >({});
  const [lookupLocationCode, setLookupLocationCode] = useState("");

  const todayKey = new Date().toDateString();
  const bookingDayOptions = useMemo(
    () => buildBookingDayOptions(new Date()),
    [todayKey],
  );

  const latestBotMessageText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.sender === "bot") {
        return message.text.toLowerCase();
      }
    }
    return "";
  }, [messages]);

  const showLookupDetailInput = useMemo(() => {
    return (
      latestBotMessageText.includes("chi tiết phòng") ||
      latestBotMessageText.includes("location code") ||
      latestBotMessageText.includes("nhập location") ||
      latestBotMessageText.includes("nhập location code") ||
      latestBotMessageText.includes("nhập phòng") ||
      latestBotMessageText.includes("nhập mã phòng") ||
      latestBotMessageText.includes("không hợp lệ") ||
      latestBotMessageText.includes("không tồn tại") ||
      latestBotMessageText.includes("vui lòng nhập lại")
    );
  }, [latestBotMessageText]);

  const bookingRoomCodes = useMemo(() => {
    const codes = new Set<string>();
    messages.forEach((message) => {
      (message.bookingItems || []).forEach((item) => {
        const roomCode = resolveBookingRoomCode(item);
        if (roomCode) {
          codes.add(roomCode);
        }
      });
      if (message.roomDetail) {
        const rd = message.roomDetail;
        if (rd.locationCode) {
          codes.add(String(rd.locationCode));
        }
        if (rd.id) {
          codes.add(String(rd.id));
        }
      }
      (message.suggestions || []).forEach((s) => {
        if (s.locationCode) {
          codes.add(s.locationCode);
        }
        if (s.roomId) {
          codes.add(s.roomId);
        }
      });
    });
    return Array.from(codes);
  }, [messages]);

  const missingBookingCodes = useMemo(
    () => bookingRoomCodes.filter((code) => !bookingImageByCode[code]),
    [bookingRoomCodes, bookingImageByCode],
  );

  useEffect(() => {
    if (missingBookingCodes.length === 0) return;

    let cancelled = false;

    const loadImages = async () => {
      try {
        const cached = roomService.getRoomsMapCached();
        const mapData = cached ?? (await roomService.getRoomsMap());
        const rooms = normalizeRoomsMap(mapData);
        const nextImages: Record<string, string> = {};

        missingBookingCodes.forEach((code) => {
          const match = rooms.find(
            (room) => room.roomName.toLowerCase() === code.toLowerCase(),
          );
          if (match?.roomImage) {
            nextImages[code] = match.roomImage;
          }
        });

        if (!cancelled && Object.keys(nextImages).length > 0) {
          setBookingImageByCode((prev) => ({ ...prev, ...nextImages }));
        }
      } catch {
        // Ignore image lookup errors
      }
    };

    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [missingBookingCodes]);

  const updateBookingTimeState = useCallback((
    messageId: string,
    updater: (current: BookingTimeUiState) => BookingTimeUiState,
  ) => {
    setBookingTimeUiByMessage((prev) => {
      const current = prev[messageId] ?? {
        mode: "quick" as BookingTimeMode,
        dayIndex: 0,
        time: getAvailableTimeSlots(0, new Date())[0] ?? "",
        manualMessage: "",
      };
      return {
        ...prev,
        [messageId]: updater(current),
      };
    });
  }, []);

  // ── Derived: menu options (from API or fallback) ──────────────────────────

  const menuOptions = useMemo(
    () => (activeMenuOptions.length > 0 ? activeMenuOptions : DEFAULT_MENU_OPTIONS),
    [activeMenuOptions],
  );

  // ── Derived: suggestions ──────────────────────────────────────────────────

  const latestMessage = useMemo(
    () => messages[messages.length - 1] ?? null,
    [messages],
  );

  const latestSuggestionMessage = useMemo(() => {
    if (!latestMessage || latestMessage.sender !== "bot") return null;
    if (!latestMessage.suggestions?.length) return null;
    return latestMessage;
  }, [latestMessage]);

  const latestSuggestions = latestSuggestionMessage?.suggestions ?? [];
  const isSingleSuggestion = latestSuggestions.length === 1;
  const isSuggestionsVisible =
    latestSuggestions.length > 0 &&
    latestSuggestionMessage?.id !== dismissedSuggestionMessageId;
  const suggestionKind = latestSuggestionMessage?.suggestionType || "suggested";
  const suggestionLabel =
    suggestionKind === "alternative"
      ? "Alternative Rooms"
      : suggestionKind === "available"
        ? "Available Rooms Today"
        : "Suggested Rooms";
  const showBestMatch = isSingleSuggestion && suggestionKind === "suggested";

  // ── User initials ─────────────────────────────────────────────────────────

  const userInitials = useMemo(() => {
    if (!profile) return "U";
    if (profile.firstName && profile.lastName) {
      return `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
    }
    if (profile.firstName) return profile.firstName[0].toUpperCase();
    if (profile.email) return profile.email[0].toUpperCase();
    return "U";
  }, [profile]);

  // ── LocalStorage persistence ──────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WIDGET_STORAGE_KEY);
      if (!raw) {
        setIsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<StoredWidgetState>;
      if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
      if (
        typeof parsed.aiSessionId === "string" ||
        parsed.aiSessionId === null
      ) {
        setAiSessionId(parsed.aiSessionId ?? null);
      }
      if (typeof parsed.hasGreeted === "boolean")
        setHasGreeted(parsed.hasGreeted);
    } catch {
      // Ignore invalid storage payload.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const payload: StoredWidgetState = { messages, aiSessionId, hasGreeted };
    window.localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(payload));
  }, [aiSessionId, hasGreeted, isHydrated, messages]);

  // ── Profile fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get<UserProfile | { data: UserProfile }>(
          API_ENDPOINTS.AUTH.PROFILE,
        );
        const raw = res.data;
        const nested = (raw as { data?: UserProfile }).data;
        setProfile(nested || (raw as UserProfile) || null);
      } catch {
        setProfile(null);
      }
    };
    fetchProfile();
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessageToAi = useCallback(
    async (content: string) => {
      if (!content || isSending) return;

      const now = new Date().toISOString();
      const userMessage: ChatBubbleMessage = {
        id: createId(),
        sender: "user",
        text: content,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);

      try {
        const response: AiChatResponseDto = await aiService.chat({
          message: content,
          sessionId: aiSessionId ?? undefined,
        });

        if (response.sessionId) setAiSessionId(response.sessionId);

        // Update active menu options if the response provides them
        if (response.menuOptions && response.menuOptions.length > 0) {
          setActiveMenuOptions(response.menuOptions);
        }

        const botMessage: ChatBubbleMessage = {
          id: createId(),
          sender: "bot",
          text: response.reply,
          createdAt: new Date().toISOString(),
          intent: response.intent,
          suggestionType: response.suggestionType,
          suggestions: response.suggestions,
          menuOptions: response.menuOptions,
          bookingItems: response.bookingItems,
          reservation: response.reservation,
          reservationCreated: response.reservationCreated,
          roomDetail: response.roomDetail as
            | Record<string, unknown>
            | null
            | undefined,
        };
        setMessages((prev) => [...prev, botMessage]);
      } catch (err: unknown) {
        const fallbackMessage =
          "Sorry, UniBot is unavailable right now. Please try again later.";
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            sender: "bot",
            text: extractApiMessage(err, fallbackMessage),
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [aiSessionId, isSending],
  );

  // ── Handle send ───────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const content = (overrideText ?? inputValue).trim();
      if (!content) return;
      if (!overrideText) setInputValue("");
      await sendMessageToAi(content);
    },
    [inputValue, sendMessageToAi],
  );

  // ── Quick action select ───────────────────────────────────────────────────

  const handleQuickAction = useCallback(
    async (option: AiMenuOption) => {
      if (isSending) return;
      setLookupLocationCode("");
      await sendMessageToAi(resolveQuickActionLabel(option));
    },
    [isSending, sendMessageToAi],
  );

  const handleCapacityRangeSelect = useCallback(
    async (label: string) => {
      if (isSending) return;
      await sendMessageToAi(`Tìm kiếm theo sức chứa ${label}`);
    },
    [isSending, sendMessageToAi],
  );

  const handleLookupDetailSubmit = useCallback(async () => {
    if (isSending) return;
    const code = lookupLocationCode.trim();
    if (!code) return;

    await sendMessageToAi(`Chi tiết phòng ${code}`);
    setLookupLocationCode("");
  }, [isSending, lookupLocationCode, sendMessageToAi]);

  // ── Room navigation resolver ──────────────────────────────────────────────

  const resolveSuggestionForNavigation = useCallback(
    async (suggestion: AiRoomSuggestion) => {
      let resolvedRoomId = toText(suggestion.roomId);
      let resolvedRoomData: Record<string, unknown> | null = null;
      let resolvedBuilding = "";
      let resolvedFloor = "";

      if (!resolvedRoomId) {
        const code = toText(suggestion.locationCode).toLowerCase();
        if (!code) return null;

        try {
          const roomsMap = await roomService.getRoomsMap();
          for (const building of roomsMap.buildingResponse || []) {
            for (const floor of building.floors || []) {
              const match = (floor.rooms || []).find((room) => {
                const locationCode = toText(
                  (room as { locationCode?: string }).locationCode,
                ).toLowerCase();
                return locationCode === code;
              });

              if (match) {
                resolvedRoomData = match as Record<string, unknown>;
                resolvedRoomId = toText(
                  (match as { roomId?: string; id?: string }).roomId ||
                    (match as { id?: string }).id,
                );
                resolvedBuilding = toText(building.buildingName);
                resolvedFloor = toText(floor.floorName);
                break;
              }
            }
            if (resolvedRoomId) break;
          }
        } catch {
          return null;
        }
      }

      if (!resolvedRoomId) return null;

      try {
        const detail = await roomService.getRoomDetail(resolvedRoomId);
        if (detail && typeof detail === "object") {
          resolvedRoomData = detail as Record<string, unknown>;
        }
      } catch {
        // Fallback to map data if room detail is not available.
      }

      const source = resolvedRoomData || {};
      const roomNode = toRecord(source.room);
      const floorNode = toRecord(source.floor);
      const buildingNode = toRecord(source.building);

      const roomState = {
        id: resolvedRoomId,
        roomName:
          toText(source.roomName) ||
          toText(source.locationCode) ||
          toText(roomNode?.roomName) ||
          toText(roomNode?.locationCode) ||
          toText(suggestion.locationCode) ||
          resolvedRoomId,
        building:
          toText(source.building) ||
          toText(source.buildingName) ||
          toText(roomNode?.buildingName) ||
          toText(roomNode?.building) ||
          toText(buildingNode?.name) ||
          toText(buildingNode?.buildingName) ||
          toText(
            (buildingNode as Record<string, unknown> | null)?.code,
          ) ||
          toText(suggestion.building) ||
          resolvedBuilding,
        floorInfo:
          toText(source.floorInfo) ||
          toText(source.floorName) ||
          toText(source.floor) ||
          toText(roomNode?.floorInfo) ||
          toText(roomNode?.floorName) ||
          toText(roomNode?.floor) ||
          toText(floorNode?.name) ||
          toText(floorNode?.floorName) ||
          toText(
            (floorNode as Record<string, unknown> | null)?.floorInfo,
          ) ||
          toText(suggestion.floor) ||
          resolvedFloor,
        slot: toPositiveNumber(source.slot || source.capacity),
        status:
          String(
            source.status || suggestion.status || "AVAILABLE",
          ).toUpperCase() === "AVAILABLE"
            ? "AVAILABLE"
            : "OCCUPIED",
      };

      return { roomId: resolvedRoomId, roomState };
    },
    [],
  );

  const handleBookNow = useCallback(
    async (suggestion: AiRoomSuggestion) => {
      const resolved = await resolveSuggestionForNavigation(suggestion);
      if (!resolved) return;
      navigate(ROUTES.ROOM_DETAIL.replace(":roomId", resolved.roomId), {
        state: { room: resolved.roomState },
      });
    },
    [navigate, resolveSuggestionForNavigation],
  );

  const handleViewDetails = useCallback(
    async (suggestion: AiRoomSuggestion) => {
      const resolved = await resolveSuggestionForNavigation(suggestion);
      if (!resolved) return;
      navigate(ROUTES.ROOM_DETAIL.replace(":roomId", resolved.roomId), {
        state: { room: resolved.roomState },
      });
    },
    [navigate, resolveSuggestionForNavigation],
  );

  const handleViewBookingDetail = useCallback(
    (reservation?: Reservation | null) => {
      const source = toRecord(reservation);
      if (!source) return;
      const bookingId = toText(source.id) || toText(source.reservationId);
      if (!bookingId) return;
      navigate(ROUTES.BOOKING_DETAIL.replace(":bookingId", bookingId), {
        state: { booking: reservation },
      });
    },
    [navigate],
  );

  // ── Greeting on first open ────────────────────────────────────────────────

  const greetIfNeeded = useCallback(() => {
    if (!isHydrated || hasGreeted || messages.length > 0) return;
    setMessages([
      {
        id: createId(),
        sender: "bot",
        text: "Xin chào! Tôi là UniBot. Tôi có thể giúp gì cho bạn hôm nay?",
        createdAt: new Date().toISOString(),
      },
    ]);
    setHasGreeted(true);
  }, [hasGreeted, isHydrated, messages.length]);

  return {
    // State
    messages,
    inputValue,
    isSending,
    isHydrated,
    aiSessionId,
    previewImageUrl,
    profile,
    userInitials,
    messagesEndRef,
    menuOptions,
    // Derived suggestion state
    latestSuggestionMessage,
    latestSuggestions,
    isSingleSuggestion,
    isSuggestionsVisible,
    suggestionKind,
    suggestionLabel,
    showBestMatch,
    dismissedSuggestionMessageId,
    // New states and memos
    bookingImageByCode,
    bookingTimeUiByMessage,
    lookupLocationCode,
    bookingDayOptions,
    showLookupDetailInput,
    latestBotMessageText,
    // Actions
    setInputValue,
    setPreviewImageUrl,
    setDismissedSuggestionMessageId,
    setLookupLocationCode,
    handleSend,
    handleQuickAction,
    sendMessageToAi,
    handleBookNow,
    handleViewDetails,
    handleViewBookingDetail,
    greetIfNeeded,
    scrollToBottom,
    updateBookingTimeState,
    handleLookupDetailSubmit,
    handleCapacityRangeSelect,
    // Re-exports from chatHelpers for convenience
    getBookingCardData,
    bookingStatusClass,
    formatDateTimeLabel,
    toText,
    toNumberOrNull,
    toRecord,
  };
}

