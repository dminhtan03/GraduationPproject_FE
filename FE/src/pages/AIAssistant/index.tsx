import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { aiService } from "../../services/aiService";
import type {
  AiChatResponseDto,
  AiMenuOption,
  AiRoomSuggestion,
} from "../../types/api";
import type { UserProfile } from "../../types";
import { ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { roomService } from "../../services/roomService";
import { ConfirmDialog } from "../../components/common";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { ChatMessage, ChatSessionSummary } from "../../types/chat";
import { BOOKING_ITEM_FALLBACK_IMAGE } from "../../constants/aiAssistant";
import {
  buildAssistantStorageKey,
  deriveStoredSessions,
  getStoredAssistantState,
  mergeSessionsById,
  resolveBookingRoomCode,
  resolveQuickActionLabel,
  CAPACITY_RANGE_OPTIONS,
  type BookingTimeMode,
  type BookingTimeUiState,
  buildBookingDayOptions,
  getAvailableTimeSlots,
} from "../../utils/aiAssistant";
import {
  createId,
  createWelcomeMessage,
  formatClock,
  formatDate,
  formatDateTimeLabel,
  mapDetailMessageToChatMessage,
  mapHistorySessionToSummary,
  bookingStatusClass,
  getBookingCardData,
  toText,
  toPositiveNumber,
  toSessionTitle,
  toSessionSubtitle,
  DEFAULT_CHAT_TITLE,
  DEFAULT_CHAT_SUBTITLE,
  toRecord,
} from "../../utils/chatHelpers";
import { normalizeRoomsMap } from "../../utils/roomList";
const EMPTY_MESSAGES_BY_SESSION: Record<string, ChatMessage[]> = {};
const AIAssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const storageKey = useMemo(
    () => buildAssistantStorageKey(profile),
    [profile],
  );

  const storedAssistantState = useMemo(
    () => getStoredAssistantState(storageKey),
    [storageKey],
  );
  const initialStoredMessagesBySession =
    storedAssistantState?.messagesBySession ?? EMPTY_MESSAGES_BY_SESSION;
  const initialStoredSessions = useMemo(
    () => deriveStoredSessions(initialStoredMessagesBySession),
    [initialStoredMessagesBySession],
  );

  const [sessions, setSessions] = useState<ChatSessionSummary[]>(
    () => initialStoredSessions,
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    () =>
      storedAssistantState?.selectedSessionId ||
      initialStoredSessions[0]?.id ||
      "",
  );
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, ChatMessage[]>
  >(() => initialStoredMessagesBySession);

  const [isSending, setIsSending] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] =
    useState<ChatSessionSummary | null>(null);
  const [deleteToast, setDeleteToast] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(
    Object.keys(initialStoredMessagesBySession).length > 0,
  );
  const [collapsedSuggestionMessageId, setCollapsedSuggestionMessageId] =
    useState<string | null>(null);
  const [activeMenuOptions, setActiveMenuOptions] = useState<AiMenuOption[]>(
    [],
  );
  const [lookupLocationCode, setLookupLocationCode] = useState("");
  const [bookingImageByCode, setBookingImageByCode] = useState<
    Record<string, string>
  >({});
  const [bookingTimeUiByMessage, setBookingTimeUiByMessage] = useState<
    Record<string, BookingTimeUiState>
  >({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const loadedSessionDetailsRef = useRef<Set<string>>(
    new Set(Object.keys(initialStoredMessagesBySession)),
  );
  const todayKey = new Date().toDateString();
  const bookingDayOptions = useMemo(
    () => buildBookingDayOptions(new Date()),
    [todayKey],
  );

  useEffect(() => {
    const stored = getStoredAssistantState(storageKey);
    const nextMessagesBySession =
      stored?.messagesBySession ?? EMPTY_MESSAGES_BY_SESSION;
    const nextSessions = deriveStoredSessions(nextMessagesBySession);

    setSessions(nextSessions);
    setSelectedSessionId(
      stored?.selectedSessionId || nextSessions[0]?.id || "",
    );
    setMessagesBySession(nextMessagesBySession);
    setIsHydrated(Object.keys(nextMessagesBySession).length > 0);
    loadedSessionDetailsRef.current = new Set(
      Object.keys(nextMessagesBySession),
    );
    setActiveMenuOptions([]);
    setLookupLocationCode("");
    setBookingTimeUiByMessage({});
  }, [storageKey]);

  const createEmptySession = useCallback(async () => {
    const aiSessionId = await aiService.addChat();
    const now = new Date().toISOString();

    return {
      id: aiSessionId,
      title: DEFAULT_CHAT_TITLE,
      subtitle: DEFAULT_CHAT_SUBTITLE,
      createdAt: now,
      aiSessionId,
    } satisfies ChatSessionSummary;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const history = await aiService.getChatHistory();
        if (cancelled) return;

        const storedSelectedSessionId =
          storedAssistantState?.selectedSessionId || "";

        if (history.length > 0) {
          const mappedSessions = history.map(mapHistorySessionToSummary);
          const mergedSessions = mergeSessionsById(
            mappedSessions,
            initialStoredSessions,
          );
          const nextSelectedSessionId =
            mergedSessions.find(
              (session) => session.id === storedSelectedSessionId,
            )?.id ||
            mergedSessions[0]?.id ||
            "";

          setSessions(mergedSessions);
          setSelectedSessionId(nextSelectedSessionId);
          return;
        }

        if (initialStoredSessions.length > 0) {
          const nextSelectedSessionId =
            initialStoredSessions.find(
              (session) => session.id === storedSelectedSessionId,
            )?.id ||
            initialStoredSessions[0]?.id ||
            "";

          setSessions(initialStoredSessions);
          setSelectedSessionId(nextSelectedSessionId);
          return;
        }

        const session = await createEmptySession();
        if (cancelled) return;

        loadedSessionDetailsRef.current.add(session.id);
        setSessions([session]);
        setSelectedSessionId(session.id);
        setMessagesBySession({
          [session.id]: [],
        });
      } catch {
        if (cancelled) return;

        if (initialStoredSessions.length > 0) {
          const nextSelectedSessionId =
            initialStoredSessions.find(
              (session) =>
                session.id === storedAssistantState?.selectedSessionId,
            )?.id ||
            initialStoredSessions[0]?.id ||
            "";

          setSessions(initialStoredSessions);
          setSelectedSessionId(nextSelectedSessionId);
          return;
        }

        const fallbackId = createId();
        loadedSessionDetailsRef.current.add(fallbackId);
        setSessions([
          {
            id: fallbackId,
            title: DEFAULT_CHAT_TITLE,
            subtitle: DEFAULT_CHAT_SUBTITLE,
            createdAt: new Date().toISOString(),
          },
        ]);
        setSelectedSessionId(fallbackId);
        setMessagesBySession({
          [fallbackId]: [],
        });
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
          setIsHydrated(true);
        }
      }
    };

    void bootstrapChatHistory();

    return () => {
      cancelled = true;
    };
  }, [createEmptySession, initialStoredSessions, storedAssistantState]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get<UserProfile | { data: UserProfile }>(
          API_ENDPOINTS.AUTH.PROFILE,
        );
        const raw = res.data;
        const nested = (raw as { data?: UserProfile }).data;
        const userData: UserProfile | null = nested || (raw as UserProfile);
        setProfile(userData || null);
      } catch {
        setProfile(null);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          messagesBySession,
          selectedSessionId: selectedSessionId || null,
        }),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [isHydrated, messagesBySession, selectedSessionId, storageKey]);

  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [sessions, selectedSessionId]);

  const selectedMessages = useMemo(() => {
    return messagesBySession[selectedSessionId] ?? [];
  }, [messagesBySession, selectedSessionId]);

  const latestBotMessageText = useMemo(() => {
    for (let index = selectedMessages.length - 1; index >= 0; index -= 1) {
      const message = selectedMessages[index];
      if (message.sender === "bot") {
        return message.text.toLowerCase();
      }
    }
    return "";
  }, [selectedMessages]);

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
    selectedMessages.forEach((message) => {
      (message.bookingItems || []).forEach((item) => {
        const roomCode = resolveBookingRoomCode(item);
        if (roomCode) {
          codes.add(roomCode);
        }
      });
      if (message.roomDetail) {
        if (message.roomDetail.locationCode) {
          codes.add(message.roomDetail.locationCode);
        }
        if (message.roomDetail.id) {
          codes.add(message.roomDetail.id);
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
  }, [selectedMessages]);

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

  const isSelectedSessionLoading =
    !!selectedSession &&
    loadingSessionId === selectedSession.id &&
    selectedMessages.length === 0;

  useEffect(() => {
    if (!selectedSession?.aiSessionId) return;
    if (loadedSessionDetailsRef.current.has(selectedSession.id)) return;

    let cancelled = false;
    loadedSessionDetailsRef.current.add(selectedSession.id);
    setLoadingSessionId(selectedSession.id);

    const loadSessionDetail = async () => {
      try {
        const detail = await aiService.getChatHistoryDetail(
          selectedSession.aiSessionId as string,
        );
        if (cancelled) return;

        const mappedMessages = detail.messages
          .map((message) => mapDetailMessageToChatMessage(message))
          .filter((message): message is ChatMessage => message !== null);

        setMessagesBySession((prev) => {
          if ((prev[selectedSession.id]?.length ?? 0) > 0) {
            return prev;
          }

          return {
            ...prev,
            [selectedSession.id]:
              mappedMessages.length > 0
                ? mappedMessages
                : [],
          };
        });

        setSessions((prev) =>
          prev.map((session) => {
            if (session.id !== selectedSession.id) return session;

            const lastMessage = toText(detail.lastMessage);
            const shouldUpdateTitle = session.title === DEFAULT_CHAT_TITLE;

            return {
              ...session,
              title: shouldUpdateTitle
                ? toSessionTitle(lastMessage)
                : session.title,
              subtitle: toSessionSubtitle(lastMessage),
              createdAt: detail.startedAt || session.createdAt,
            };
          }),
        );
      } catch {
        if (cancelled) return;

        setMessagesBySession((prev) => {
          if ((prev[selectedSession.id]?.length ?? 0) > 0) return prev;

          return {
            ...prev,
            [selectedSession.id]: [],
          };
        });
      } finally {
        if (!cancelled) {
          setLoadingSessionId((current) =>
            current === selectedSession.id ? null : current,
          );
        }
      }
    };

    void loadSessionDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedSession]);

  const latestMessage = useMemo(
    () => selectedMessages[selectedMessages.length - 1] ?? null,
    [selectedMessages],
  );

  const latestSuggestionMessage = useMemo(() => {
    if (!latestMessage || latestMessage.sender !== "bot") return null;
    if (!latestMessage.suggestions?.length) return null;
    return latestMessage;
  }, [latestMessage]);

  const latestSuggestionMessageId = latestSuggestionMessage?.id || "";

  const isSuggestionsCollapsed =
    !!latestSuggestionMessageId &&
    latestSuggestionMessageId === collapsedSuggestionMessageId;

  let userInitials = "U";
  if (profile) {
    if (profile.firstName && profile.lastName) {
      userInitials =
        `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
    } else if (profile.firstName) {
      userInitials = profile.firstName[0].toUpperCase();
    } else if (profile.email) {
      userInitials = profile.email[0].toUpperCase();
    }
  }

  const isLookupAction = useCallback((option: AiMenuOption) => {
    const intent = String(option.intent || "").toUpperCase();
    const label = resolveQuickActionLabel(option).toLowerCase();
    return intent === "LOOKUP" || label.includes("tra cứu");
  }, []);

  const shouldShowMenuCode = (code?: string | number | null) => {
    const value = String(code ?? "").trim();
    return value.length > 0 && value.length <= 3;
  };

  const sendMessageToAi = useCallback(
    async (content: string, _mode: "chat" | "voice") => {
      void _mode;
      if (!content || isSending || !selectedSession) return;

      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: createId(),
        sender: "user",
        text: content,
        createdAt: now,
      };

      loadedSessionDetailsRef.current.add(selectedSession.id);

      setMessagesBySession((prev) => ({
        ...prev,
        [selectedSession.id]: [
          ...(prev[selectedSession.id] ?? []),
          userMessage,
        ],
      }));

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== selectedSession.id) return session;
          const shouldUpdateTitle = session.title === DEFAULT_CHAT_TITLE;
          return {
            ...session,
            title: shouldUpdateTitle ? toSessionTitle(content) : session.title,
            subtitle: content,
          };
        }),
      );

      setIsSending(true);
      try {
        const response: AiChatResponseDto = await aiService.chat({
          message: content,
          sessionId: selectedSession.aiSessionId,
        });

        const botMessage: ChatMessage = {
          id: createId(),
          sender: "bot",
          text: response.reply,
          createdAt: new Date().toISOString(),
          intent: response.intent,
          suggestionType: response.suggestionType,
          suggestions: response.suggestions,
          menuOptions: response.menuOptions,
          bookingItems: response.bookingItems,
          roomDetail: response.roomDetail,
          reservation: response.reservation,
          reservationCreated: response.reservationCreated,
        };

        setMessagesBySession((prev) => ({
          ...prev,
          [selectedSession.id]: [
            ...(prev[selectedSession.id] ?? []),
            botMessage,
          ],
        }));

        setSessions((prev) =>
          prev.map((session) => {
            if (session.id !== selectedSession.id) return session;
            return {
              ...session,
              subtitle: response.reply,
              aiSessionId: response.sessionId || session.aiSessionId,
            };
          }),
        );
      } catch (error: unknown) {
        const fallbackMessage =
          "AI service is unavailable. Please try again later.";
        const botMessage: ChatMessage = {
          id: createId(),
          sender: "bot",
          text: extractApiMessage(error, fallbackMessage),
          createdAt: new Date().toISOString(),
        };
        setMessagesBySession((prev) => ({
          ...prev,
          [selectedSession.id]: [
            ...(prev[selectedSession.id] ?? []),
            botMessage,
          ],
        }));
      } finally {
        setIsSending(false);
      }
    },
    [isSending, selectedSession],
  );

  const handleSelectAction = useCallback(
    async (menuOption: AiMenuOption) => {
      if (isSending || !selectedSession) return;
      await sendMessageToAi(menuOption.label, "chat");
    },
    [isSending, selectedSession, sendMessageToAi],
  );

  const handleCapacityRangeSelect = useCallback(
    async (label: string) => {
      if (isSending || !selectedSession) return;

      await sendMessageToAi(
        `T\u00ecm ki\u1ebfm theo s\u1ee9c ch\u1ee9a ${label}`,
        "chat",
      );
    },
    [isSending, selectedSession, sendMessageToAi],
  );

  const handleLookupDetailSubmit = useCallback(async () => {
    if (isSending || !selectedSession) return;
    const code = lookupLocationCode.trim();
    if (!code) return;

    await sendMessageToAi(`Chi tiết phòng ${code}`, "chat");
    setLookupLocationCode("");
  }, [isSending, lookupLocationCode, selectedSession, sendMessageToAi]);

  const handleQuickActionSelect = useCallback(
    async (menuOption: AiMenuOption) => {
      if (isSending || !selectedSession) return;
      if (isLookupAction(menuOption)) {
        setLookupLocationCode("");
        await sendMessageToAi(resolveQuickActionLabel(menuOption), "chat");
        return;
      }
      setLookupLocationCode("");
      await sendMessageToAi(resolveQuickActionLabel(menuOption), "chat");
    },
    [isLookupAction, isSending, selectedSession, sendMessageToAi],
  );

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [selectedMessages, isSending]);

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.sender === "user";
    const normalizedIntent = String(message.intent || "").toUpperCase();
    const bookingActionLabel =
      normalizedIntent === "CANCEL_RESERVATION"
        ? "Hủy phòng"
        : normalizedIntent === "EXTEND_RESERVATION"
          ? "Gia hạn phòng"
          : "";
    const bookingItems = message.bookingItems || [];
    const roomDetail = message.roomDetail;
    const roomDetailId = toText(roomDetail?.id);
    const roomDetailLocationCodeRaw = toText(roomDetail?.locationCode);
    const roomDetailLocationCode = roomDetailLocationCodeRaw || "-";
    const roomDetailImages = Array.isArray(roomDetail?.images)
      ? roomDetail.images.filter(Boolean)
      : [];
    const resolvedImageFromMap = roomDetailLocationCodeRaw
      ? bookingImageByCode[roomDetailLocationCodeRaw] ||
        bookingImageByCode[roomDetailId]
      : null;
    const roomDetailImage =
      roomDetailImages.length > 0
        ? roomDetailImages[0]
        : resolvedImageFromMap || null;
    const roomDetailAmenities = Array.isArray(roomDetail?.amenities)
      ? roomDetail.amenities
      : [];
    const roomDetailCapacity =
      typeof roomDetail?.capacity === "number" ? roomDetail.capacity : null;
    const roomDetailScore =
      typeof roomDetail?.score === "number" ? roomDetail.score : null;
    const roomDetailCurrentUser = toText(roomDetail?.currentUserName);
    const roomDetailCheckInTime = toText(roomDetail?.checkInTime);
    const roomDetailCheckInLabel = roomDetailCheckInTime
      ? formatDateTimeLabel(roomDetailCheckInTime)
      : "";
    const roomDetailFeedbacks = Array.isArray(roomDetail?.feedbacks)
      ? roomDetail.feedbacks
      : [];
    const booking = getBookingCardData(message.reservation);
    const bookingId =
      toText(message.reservation?.id) ||
      toText(message.reservation?.rawData?.reservationId);

    const textNormalized = message.text.toLowerCase();
    const isBookingTimePrompt = textNormalized.includes("muốn đặt khi nào");
    const isLookupCapacityPrompt =
      textNormalized.includes("khoảng sức chứa") ||
      textNormalized.includes("nhập sức chứa");
    const isDurationPrompt =
      textNormalized.includes("trong bao lâu") ||
      textNormalized.includes("thêm bao lâu");
    const isCapacityPrompt = textNormalized.includes("bao nhiêu người");
    const isNoCapacityMatchPrompt =
      (textNormalized.includes("không tìm thấy phòng phù hợp") ||
        textNormalized.includes("không tìm thấy phòng nào phù hợp") ||
        textNormalized.includes("không có phòng phù hợp")) &&
      textNormalized.includes("người");

    const getFallbackBookingTimeState = () => ({
      mode: "quick" as BookingTimeMode,
      dayIndex: 0,
      time: getAvailableTimeSlots(0, new Date())[0] ?? "",
      manualMessage: "",
    });

    const bookingTimeState = isBookingTimePrompt
      ? (bookingTimeUiByMessage[message.id] ?? getFallbackBookingTimeState())
      : null;
    const activeBookingDay = bookingTimeState
      ? (bookingDayOptions[bookingTimeState.dayIndex] ?? bookingDayOptions[0])
      : bookingDayOptions[0];
    const availableTimeSlots = bookingTimeState
      ? getAvailableTimeSlots(activeBookingDay.offsetDays, new Date())
      : [];
    const resolvedBookingTime = bookingTimeState
      ? availableTimeSlots.includes(bookingTimeState.time)
        ? bookingTimeState.time
        : activeBookingDay.offsetDays === 0
          ? (availableTimeSlots[0] ?? "")
          : bookingTimeState.time
      : "";

    const updateBookingTimeState = (
      updater: (current: BookingTimeUiState) => BookingTimeUiState,
    ) => {
      setBookingTimeUiByMessage((prev) => {
        const current = prev[message.id] ?? getFallbackBookingTimeState();
        return {
          ...prev,
          [message.id]: updater(current),
        };
      });
    };

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring" as const, stiffness: 380, damping: 28 }}
        className={`mb-5 flex ${isUser ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              isUser
                ? "bg-orange-500 text-white"
                : "bg-orange-50 border border-orange-400 text-orange-600 shadow-sm"
            }`}
          >
            {isUser ? userInitials : "AI"}
          </div>
          <div
            className={`max-w-[85vw] sm:max-w-[70vw] xl:max-w-[44rem] rounded-2xl px-4 py-3.5 text-xs sm:text-sm leading-relaxed shadow-sm transition-all duration-200 ${
              isUser
                ? "rounded-br-none bg-gradient-to-br from-orange-500 to-orange-600 text-white font-medium shadow-orange-500/10"
                : "rounded-bl-none border border-slate-100 bg-white text-slate-800"
            }`}
          >
            <div>{message.text}</div>

            {!isUser && isBookingTimePrompt && bookingTimeState && (
              <div className="mt-3 rounded-2xl border border-orange-100 bg-white/95 p-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Ngày
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {bookingDayOptions.map((day, index) => {
                        const isActive = index === bookingTimeState.dayIndex;
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => {
                              updateBookingTimeState((current) => {
                                const nextDay =
                                  bookingDayOptions[index] ||
                                  bookingDayOptions[0];
                                const nextSlots = getAvailableTimeSlots(
                                  nextDay.offsetDays,
                                  new Date(),
                                );
                                const shouldAutoPick = nextDay.offsetDays === 0;
                                const nextTime = shouldAutoPick
                                  ? nextSlots[0] || ""
                                  : current.time;
                                const resolvedTime = nextSlots.includes(
                                  current.time,
                                )
                                  ? current.time
                                  : nextTime;

                                return {
                                  ...current,
                                  dayIndex: index,
                                  time: resolvedTime,
                                };
                              });
                            }}
                            className={`rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold transition-all hover:-translate-y-0.5 ${
                              isActive
                                ? "border-orange-300 bg-orange-500 text-white"
                                : "border-orange-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                            }`}
                          >
                            <div>{day.label}</div>
                            <div
                              className={`mt-0.5 text-[10px] ${
                                isActive ? "text-white/85" : "text-slate-500"
                              }`}
                            >
                              {day.dateLabel}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Giờ bắt đầu
                    </p>
                    {availableTimeSlots.length > 0 ? (
                      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {availableTimeSlots.map((time) => {
                          const isActive = time === resolvedBookingTime;
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() =>
                                updateBookingTimeState((current) => ({
                                  ...current,
                                  time,
                                }))
                              }
                              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 ${
                                isActive
                                  ? "border-orange-300 bg-orange-500 text-white"
                                  : "border-orange-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                              }`}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        Hôm nay đã hết khung giờ trống.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2">
                    <span className="text-xs text-slate-700">
                      {resolvedBookingTime
                        ? `Đặt lúc ${resolvedBookingTime} — ${activeBookingDay.label}`
                        : "Chọn giờ bắt đầu"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!resolvedBookingTime) return;
                        void sendMessageToAi(
                          `${activeBookingDay.label} lúc ${resolvedBookingTime}`,
                          "chat",
                        );
                      }}
                      disabled={
                        !resolvedBookingTime || isSending || !selectedSession
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!isUser && isLookupCapacityPrompt && (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {CAPACITY_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void handleCapacityRangeSelect(option.label)}
                    disabled={isSending || !selectedSession}
                    className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-800 transition hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {!isUser && isCapacityPrompt && !isNoCapacityMatchPrompt && (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {CAPACITY_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void sendMessageToAi(option.message, "chat")}
                    disabled={isSending || !selectedSession}
                    className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-800 transition hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {!isUser && isNoCapacityMatchPrompt && (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {CAPACITY_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        void sendMessageToAi(option.message, "chat")
                      }
                      disabled={isSending || !selectedSession}
                      className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-800 transition hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isUser &&
              isDurationPrompt &&
              (() => {
                const DURATION_STEP = 30;
                const DURATION_MIN = 30;
                const DURATION_MAX = 480;
                const currentMinutes =
                  bookingTimeUiByMessage[message.id]?.durationMinutes ?? 60;
                const hours = Math.floor(currentMinutes / 60);
                const mins = currentMinutes % 60;
                const durationLabel =
                  hours > 0 && mins > 0
                    ? `${hours} tiếng ${mins} phút`
                    : hours > 0
                      ? `${hours} tiếng`
                      : `${mins} phút`;
                return (
                  <div className="mt-3 rounded-2xl border border-orange-100 bg-white/95 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 min-w-[280px] sm:min-w-[420px] transition-all duration-300">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                      Chọn thời lượng
                    </p>
                    <div className="relative flex items-center group w-full mb-3">
                      <input
                        type="range"
                        min={DURATION_MIN}
                        max={DURATION_MAX}
                        step={DURATION_STEP}
                        value={currentMinutes}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBookingTimeUiByMessage((prev) => ({
                            ...prev,
                            [message.id]: {
                              ...(prev[message.id] ?? {
                                mode: "quick" as BookingTimeMode,
                                dayIndex: 0,
                                time: "",
                                manualMessage: "",
                              }),
                              durationMinutes: val,
                            },
                          }));
                        }}
                        className="w-full h-2 bg-orange-100 rounded-lg appearance-none cursor-pointer accent-orange-500 outline-none transition-all duration-300 hover:bg-orange-200 focus:outline-none [&::-webkit-slider-thumb]:h-4.5 [&::-webkit-slider-thumb]:w-4.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-orange-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:active:scale-110 [&::-moz-range-thumb]:h-4.5 [&::-moz-range-thumb]:w-4.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-orange-500 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-orange-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-150 [&::-moz-range-thumb]:hover:scale-125 [&::-moz-range-thumb]:active:scale-110"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400">
                        30 phút
                      </span>
                      <span className="rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-xs font-bold text-orange-700 shadow-sm animate-pulse">
                        {durationLabel}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        8 tiếng
                      </span>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          void sendMessageToAi(durationLabel, "chat")
                        }
                        disabled={isSending || !selectedSession}
                        className="rounded-lg border border-orange-300 bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Xác nhận
                      </button>
                    </div>
                  </div>
                );
              })()}

            {!isUser && bookingItems.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bookingItems.map((item) => {
                  const roomCode = resolveBookingRoomCode(item);
                  const labelParts = item.label ? item.label.split("|") : [];
                  const labelRange = labelParts[1]?.trim() || "";
                  const statusPart = labelParts[2]?.trim() || "";
                  const timeRange =
                    item.startTime && item.endTime
                      ? `${item.startTime} - ${item.endTime}`
                      : labelRange;
                  const imageUrl =
                    (roomCode && bookingImageByCode[roomCode]) ||
                    BOOKING_ITEM_FALLBACK_IMAGE;
                  const bookingItemId = item.id || "";
                  const bookingDetailPath = bookingItemId
                    ? ROUTES.BOOKING_DETAIL.replace(":bookingId", bookingItemId)
                    : "";
                  const canNavigate = Boolean(bookingDetailPath);

                  let statusBadge = null;
                  if (statusPart) {
                    let statusColorClasses =
                      "bg-slate-50 border-slate-200 text-slate-600";
                    if (statusPart.toLowerCase().includes("không đến")) {
                      statusColorClasses =
                        "bg-red-50 border-red-200 text-red-700 font-bold shadow-sm";
                    } else if (statusPart.toLowerCase().includes("hủy")) {
                      statusColorClasses =
                        "bg-slate-100 border-slate-300 text-slate-500 line-through font-semibold";
                    } else if (
                      statusPart.toLowerCase().includes("đã") ||
                      statusPart.toLowerCase().includes("hoạt động")
                    ) {
                      statusColorClasses =
                        "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold shadow-sm";
                    }

                    statusBadge = (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${statusColorClasses}`}
                      >
                        {statusPart}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={`${item.id}-${roomCode}`}
                      role={canNavigate ? "button" : undefined}
                      tabIndex={canNavigate ? 0 : undefined}
                      onClick={() => {
                        if (!canNavigate) return;
                        navigate(bookingDetailPath);
                      }}
                      onKeyDown={(event) => {
                        if (!canNavigate) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(bookingDetailPath);
                        }
                      }}
                      className={`overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition-all duration-200 ${
                        canNavigate
                          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                          : ""
                      }`}
                    >
                      <div className="relative h-32 w-full overflow-hidden bg-orange-50">
                        <img
                          src={imageUrl}
                          alt={roomCode || "Room"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3">
                          <div className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-800">
                            {roomCode || "Room"}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="text-xs font-semibold text-slate-800">
                            {timeRange || item.label || ""}
                          </div>
                          {statusBadge}
                        </div>
                        {bookingActionLabel && roomCode && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void sendMessageToAi(
                                `${bookingActionLabel} ${roomCode}`,
                                "chat",
                              );
                            }}
                            disabled={isSending || !selectedSession}
                            className="mt-2 inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {bookingActionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isUser && roomDetail && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-md transition-shadow hover:shadow-lg">
                {/* Hero image or fallback */}
                <div className="relative h-48 w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                  {roomDetailImage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(roomDetailImage)}
                        className="relative block w-full h-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100"
                      >
                        <img
                          src={roomDetailImage}
                          alt={roomDetailLocationCode}
                          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/20" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-400 bg-slate-50 border-b border-slate-100">
                        No image
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-slate-900/10" />
                    </>
                  )}

                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-800 shadow-sm">
                      {roomDetailLocationCode}
                    </span>
                    {roomDetailScore !== null && (
                      <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                        ★ {roomDetailScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Image gallery (if more than 1 image) */}
                {roomDetailImages.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto p-2 bg-slate-50/70 border-b border-slate-100">
                    {roomDetailImages.slice(1, 5).map((img, idx) => (
                      <button
                        key={`room-img-${idx}`}
                        type="button"
                        onClick={() => setPreviewImageUrl(img)}
                        className="flex-shrink-0 overflow-hidden rounded-lg border border-orange-100 transition hover:border-orange-300"
                      >
                        <img
                          src={img}
                          alt={`${roomDetailLocationCode} ${idx + 2}`}
                          className="h-16 w-20 object-cover transition-transform duration-200 hover:scale-105"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-3 px-4 py-3.5 text-[12px] text-slate-700">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-orange-50/60 px-3 py-2">
                      <svg
                        className="w-4 h-4 text-orange-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600">
                          Room Code
                        </p>
                        <p className="font-semibold text-slate-900">
                          {roomDetailLocationCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-orange-50/60 px-3 py-2">
                      <svg
                        className="w-4 h-4 text-orange-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600">
                          Capacity
                        </p>
                        <p className="font-semibold text-slate-900">
                          {roomDetailCapacity ?? "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <svg
                        className="w-4 h-4 text-slate-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                          Current User
                        </p>
                        <p className="font-semibold text-slate-900">
                          {roomDetailCurrentUser || "No active user"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <svg
                        className="w-4 h-4 text-slate-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                          Check-in
                        </p>
                        <p className="font-semibold text-slate-900">
                          {roomDetailCheckInLabel || "No check-in"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Amenities */}
                  {roomDetailAmenities.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Amenities
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {roomDetailAmenities.slice(0, 8).map((amenity) => (
                          <span
                            key={`${roomDetailId || roomDetailLocationCode}-${amenity}`}
                            className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-medium text-orange-700"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Feedback
                    </p>
                    {roomDetailFeedbacks.length > 0 ? (
                      <div className="space-y-1.5">
                        {roomDetailFeedbacks
                          .slice(0, 3)
                          .map((feedback, index) => {
                            const rating =
                              typeof feedback?.rating === "number"
                                ? Math.max(
                                    0,
                                    Math.min(5, Math.round(feedback.rating)),
                                  )
                                : 0;
                            const description = toText(feedback?.description);
                            const createdAt = toText(feedback?.createdAt);
                            return (
                              <div
                                key={
                                  feedback?.id ||
                                  `${roomDetailId || roomDetailLocationCode}-feedback-${index}`
                                }
                                className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-semibold text-amber-500">
                                    {rating > 0
                                      ? "★".repeat(rating)
                                      : "No rating"}
                                  </div>
                                  {createdAt && (
                                    <span className="text-[10px] text-slate-400">
                                      {formatDateTimeLabel(createdAt)}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-600">
                                  {description || "No feedback description."}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
                        No feedback available for this room.
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  {(roomDetailId || roomDetailLocationCodeRaw) && (
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          void handleViewDetails({
                            roomId: roomDetailLocationCodeRaw
                              ? ""
                              : roomDetailId,
                            locationCode:
                              roomDetailLocationCodeRaw || roomDetailId,
                            status: "AVAILABLE",
                            capacity: roomDetailCapacity ?? undefined,
                            amenities:
                              roomDetailAmenities.length > 0
                                ? roomDetailAmenities
                                : undefined,
                            imageUrl: roomDetailImage || undefined,
                          });
                        }}
                        className="rounded-lg border border-orange-500 bg-orange-500 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-orange-600 hover:shadow-md"
                      >
                        View Room Detail →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isUser && (booking || message.reservationCreated) && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between gap-2 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
                    Booking Details
                  </p>
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${bookingStatusClass(
                      booking?.status || "CREATED",
                    )}`}
                  >
                    {booking?.status || "CREATED"}
                  </span>
                </div>

                {booking ? (
                  <div className="space-y-2.5 px-3 py-3 text-[12px] text-slate-700">
                    <div className="sm:hidden rounded-xl border border-orange-100 bg-orange-50/50 px-3 py-2.5">
                      <p className="font-bold text-slate-900">
                        {booking.roomCode}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-600">
                        {booking.buildingName} · {booking.floorName}
                      </p>
                      <p className="mt-1.5 text-[10px] font-semibold text-slate-900">
                        {booking.startTime} - {booking.endTime}
                      </p>
                    </div>

                    <div className="hidden sm:grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600">
                          Room
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {booking.roomCode}
                        </p>
                      </div>

                      <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600">
                          Location
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {booking.buildingName} · {booking.floorName}
                        </p>
                      </div>

                      <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-2.5 sm:col-span-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600">
                          Schedule
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {booking.startTime} - {booking.endTime}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">
                        Purpose
                      </p>
                      <p className="mt-1 text-slate-900">{booking.purpose}</p>
                    </div>

                    {booking.attendeeCount && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5">
                        <span className="inline-flex text-[10px] font-semibold text-blue-700">
                          {booking.attendeeCount} attendees
                        </span>
                      </div>
                    )}

                    {booking.note && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">
                          Note
                        </p>
                        <p className="mt-1 text-amber-900">{booking.note}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {bookingId && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              ROUTES.BOOKING_DETAIL.replace(
                                ":bookingId",
                                bookingId,
                              ),
                              { state: { booking: message.reservation } },
                            )
                          }
                          className="rounded-lg border border-orange-500 bg-orange-500 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-orange-600 hover:shadow-md"
                        >
                          View Details →
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2.5 text-xs text-orange-900">
                    Reservation has been created successfully.
                  </div>
                )}
              </div>
            )}

            {!isUser &&
              message.menuOptions &&
              message.menuOptions.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {message.menuOptions.map((option) => {
                    const showCode = shouldShowMenuCode(option.code);
                    return (
                      <button
                        key={option.code || option.label}
                        type="button"
                        onClick={() => void handleSelectAction(option)}
                        disabled={isSending}
                        className="flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-left text-[11px] font-semibold text-slate-800 transition hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {showCode && (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700">
                            {option.code}
                          </span>
                        )}
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            <div className="mt-2 flex items-center gap-1 text-[11px] opacity-70">
              <span>•</span>
              <span>{formatClock(message.createdAt)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const resolveSuggestionForNavigation = async (
    suggestion: AiRoomSuggestion,
  ) => {
    let resolvedRoomId = toText(suggestion.roomId);
    let resolvedRoomData: Record<string, unknown> | null = null;
    let resolvedBuilding = "";
    let resolvedFloor = "";

    if (!resolvedRoomId) {
      const code = toText(suggestion.locationCode).toLowerCase();
      if (!code) return;

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
        return;
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
        toText(source.locationCode) ||
        toText(suggestion.locationCode) ||
        resolvedRoomId,
      building:
        toText(source.building) ||
        toText(source.buildingName) ||
        toText(roomNode?.buildingName) ||
        toText(roomNode?.building) ||
        toText(buildingNode?.name) ||
        toText(buildingNode?.buildingName) ||
        toText((buildingNode as Record<string, unknown> | null)?.code) ||
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
        toText((floorNode as Record<string, unknown> | null)?.floorInfo) ||
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

    return {
      roomId: resolvedRoomId,
      roomState,
    };
  };

  const handleBookNow = async (suggestion: AiRoomSuggestion) => {
    const resolved = await resolveSuggestionForNavigation(suggestion);
    if (!resolved) return;

    navigate(ROUTES.ROOM_DETAIL.replace(":roomId", resolved.roomId), {
      state: { room: resolved.roomState },
    });
  };

  const handleViewDetails = async (suggestion: AiRoomSuggestion) => {
    const resolved = await resolveSuggestionForNavigation(suggestion);
    if (!resolved) return;

    navigate(ROUTES.ROOM_DETAIL.replace(":roomId", resolved.roomId), {
      state: { room: resolved.roomState },
    });
  };

  const renderSuggestionCard = (s: AiRoomSuggestion, isFeatured = false) => {
    const status = String(s.status || "").toUpperCase();
    const hasBuilding = Boolean(s.building && s.building.trim());
    const hasFloor = Boolean(s.floor && s.floor.trim());
    const hasCapacity = typeof s.capacity === "number";
    const showMetaGrid = hasBuilding || hasFloor || hasCapacity;

    const resolvedImage =
      s.imageUrl ||
      (s.locationCode ? bookingImageByCode[s.locationCode] : null) ||
      (s.roomId ? bookingImageByCode[s.roomId] : null);

    return (
      <div
        key={`${s.roomId}-${s.locationCode}`}
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${
          isFeatured
            ? "border-orange-300 ring-2 ring-orange-200 shadow-md hover:shadow-lg scale-[1.01]"
            : "border-orange-100 hover:border-orange-300 hover:shadow-md"
        }`}
      >
        {isFeatured && (
          <div className="flex items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 shadow-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              Phù hợp nhất
            </span>
          </div>
        )}

        {/* Header Image or Fallback */}
        <div className="relative h-36 w-full bg-slate-100 overflow-hidden flex items-center justify-center">
          {resolvedImage ? (
            <button
              type="button"
              onClick={() => setPreviewImageUrl(resolvedImage)}
              className="relative block w-full h-full overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50"
            >
              <img
                src={resolvedImage}
                alt={s.locationCode || s.roomId}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.05]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/20" />
            </button>
          ) : (
            <>
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400 bg-slate-50 border-b border-slate-100">
                Không có ảnh
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-slate-900/10" />
            </>
          )}

          <div className="absolute bottom-2.5 left-2.5">
            <span className="rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold text-slate-800 shadow-sm border border-slate-100">
              {s.locationCode || s.roomId}
            </span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {status === "AVAILABLE" ? (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wider shadow-sm animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Available
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[9px] font-bold text-orange-700 uppercase tracking-wider shadow-sm">
                {status || "UNKNOWN"}
              </span>
            )}
          </div>

          {showMetaGrid && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {hasBuilding && (
                <div className="flex items-center gap-2 rounded-xl bg-orange-50/50 px-2.5 py-1.5 border border-orange-100/60 shadow-sm">
                  <svg
                    className="w-3.5 h-3.5 text-orange-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-bold text-orange-600 uppercase tracking-wider">
                      Tòa nhà
                    </p>
                    <p className="truncate text-[11px] font-bold text-slate-800">
                      {s.building}
                    </p>
                  </div>
                </div>
              )}

              {hasFloor && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50/50 px-2.5 py-1.5 border border-amber-100/60 shadow-sm">
                  <svg
                    className="w-3.5 h-3.5 text-amber-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-bold text-amber-600 uppercase tracking-wider">
                      Tầng
                    </p>
                    <p className="truncate text-[11px] font-bold text-slate-800">
                      {s.floor}
                    </p>
                  </div>
                </div>
              )}

              {hasCapacity && (
                <div className="flex items-center gap-2 rounded-xl bg-sky-50/50 px-2.5 py-1.5 border border-sky-100/60 shadow-sm">
                  <svg
                    className="w-3.5 h-3.5 text-sky-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-bold text-sky-600 uppercase tracking-wider">
                      Sức chứa
                    </p>
                    <p className="truncate text-[11px] font-bold text-slate-800">
                      {s.capacity} người
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {s.availableTimeSlots && s.availableTimeSlots.length > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2 flex items-start gap-2 shadow-sm">
              <svg
                className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">
                  Khung giờ còn trống
                </p>
                <p className="mt-0.5 text-xs text-emerald-950 font-medium">
                  {s.availableTimeSlots.slice(0, 2).join(" • ")}
                </p>
              </div>
            </div>
          )}

          {s.amenities && s.amenities.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                Tiện ích phòng
              </p>
              <div className="flex flex-wrap gap-1">
                {s.amenities.slice(0, 5).map((amenity) => (
                  <span
                    key={`${s.roomId}-${amenity}`}
                    className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50/50 px-2 py-0.5 text-[9px] font-semibold text-orange-700"
                  >
                    • {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-orange-50 bg-gradient-to-r from-orange-50/40 to-amber-50/40 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            className="flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-bold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98]"
            onClick={() => handleViewDetails(s)}
          >
            Details
          </button>

          <button
            type="button"
            className="flex-1 rounded-xl border border-orange-500 bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600 hover:shadow active:scale-[0.98]"
            onClick={() => handleBookNow(s)}
          >
            Book Now
          </button>
        </div>
      </div>
    );
  };

  const suggestions = latestSuggestionMessage?.suggestions || [];
  const isSingleSuggestion = suggestions.length === 1;
  const suggestionKind = latestSuggestionMessage?.suggestionType || "suggested";
  const suggestionLabel =
    suggestionKind === "alternative"
      ? "Alternative Rooms"
      : suggestionKind === "available"
        ? "Available Rooms Today"
        : "Suggested Rooms";
  const showBestMatch = isSingleSuggestion && suggestionKind === "suggested";
  const shouldEnableConversationScroll = sessions.length > 5;

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsMobileHistoryOpen(false);
  };

  const requestDeleteSession = useCallback((session: ChatSessionSummary) => {
    setPendingDeleteSession(session);
  }, []);

  const handleNewChat = useCallback(async () => {
    if (isCreatingChat) return;

    setIsCreatingChat(true);
    try {
      const newSession = await createEmptySession();

      setSessions((prev) => [
        newSession,
        ...prev.filter((session) => session.id !== newSession.id),
      ]);
      setSelectedSessionId(newSession.id);

      // Fetch the initial AI menu by sending an empty message to the backend
      try {
        const menuResponse = await aiService.chat({
          message: "",
          sessionId: newSession.aiSessionId,
        });
        const welcomeMsg: ChatMessage = {
          id: createId(),
          sender: "bot",
          text: menuResponse.reply,
          createdAt: new Date().toISOString(),
          intent: menuResponse.intent,
          menuOptions: menuResponse.menuOptions,
        };
        setMessagesBySession((prev) => ({
          ...prev,
          [newSession.id]: [welcomeMsg],
        }));
        if (menuResponse.menuOptions && menuResponse.menuOptions.length > 0) {
          setActiveMenuOptions(menuResponse.menuOptions);
        }
      } catch {
        setMessagesBySession((prev) => ({
          ...prev,
          [newSession.id]: [],
        }));
      }
    } catch {
      // Keep current chat if creating a new chat fails.
    } finally {
      setIsCreatingChat(false);
      setIsMobileHistoryOpen(false);
    }
  }, [createEmptySession, isCreatingChat]);

  const showDeleteToast = useCallback(
    (type: MessageType, nextMessage: string) => {
      setDeleteToast({ type, message: nextMessage });
      window.setTimeout(() => {
        setDeleteToast((current) =>
          current && current.type === type && current.message === nextMessage
            ? null
            : current,
        );
      }, 3000);
    },
    [],
  );

  const toggleSuggestionsAccordion = useCallback(() => {
    if (!latestSuggestionMessageId) return;

    setCollapsedSuggestionMessageId((current) =>
      current === latestSuggestionMessageId ? null : latestSuggestionMessageId,
    );
  }, [latestSuggestionMessageId]);

  const handleDeleteSession = useCallback(async () => {
    if (!pendingDeleteSession || isDeletingSession) return;

    const targetSession = pendingDeleteSession;
    const sessionId = targetSession.aiSessionId || targetSession.id;

    if (!sessionId) {
      setPendingDeleteSession(null);
      return;
    }

    setIsDeletingSession(true);
    try {
      await aiService.deleteChat(sessionId);
      showDeleteToast("success", "Conversation deleted successfully.");
    } catch {
      showDeleteToast(
        "error",
        "Failed to delete conversation. Please try again.",
      );
    } finally {
      setIsDeletingSession(false);
    }

    const remainingSessions = sessions.filter(
      (item) => item.id !== targetSession.id,
    );

    setSessions(remainingSessions);
    setMessagesBySession((prev) => {
      const next = { ...prev };
      delete next[targetSession.id];
      return next;
    });

    if (selectedSessionId === targetSession.id) {
      if (remainingSessions.length > 0) {
        setSelectedSessionId(remainingSessions[0].id);
      } else {
        setSelectedSessionId("");
        await handleNewChat();
      }
    }

    setPendingDeleteSession(null);
    setIsMobileHistoryOpen(false);
  }, [
    handleNewChat,
    isDeletingSession,
    pendingDeleteSession,
    selectedSessionId,
    sessions,
    showDeleteToast,
  ]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="ai-assistant-enter relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-3 sm:p-6"
    >
      <div className="pointer-events-none absolute -left-12 top-8 h-40 w-40 rounded-full bg-slate-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-10 h-48 w-48 rounded-full bg-slate-200/50 blur-3xl" />

      <div className="relative grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
        <aside className="hidden xl:col-span-4 xl:block 2xl:col-span-3">
          <div className="flex max-h-[280px] min-h-0 flex-col rounded-3xl border border-orange-100 bg-white/95 p-4 shadow-md backdrop-blur-md sm:max-h-[340px] sm:p-5 xl:max-h-none xl:min-h-[620px] transition-all duration-300 hover:shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-orange-700">
                  Conversations
                </h2>
                <p className="text-[10px] text-orange-500 font-medium mt-0.5">
                  UniBot History
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleNewChat()}
                disabled={isCreatingChat}
                className="rounded-xl border border-orange-200 bg-white px-3.5 py-1.5 text-xs font-bold text-orange-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 active:translate-y-0 active:scale-95 disabled:opacity-60"
              >
                {isCreatingChat ? "Creating..." : "+ New Chat"}
              </button>
            </div>

            <div
              className={`space-y-2 pr-1 ${
                shouldEnableConversationScroll
                  ? "max-h-[22rem] overflow-y-auto"
                  : ""
              }`}
            >
              {isLoadingHistory && sessions.length === 0 && (
                <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-600">
                  Loading conversations...
                </p>
              )}

              {sessions.map((session) => {
                const active = session.id === selectedSessionId;
                return (
                  <div key={session.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => handleSelectSession(session.id)}
                      className={`w-full rounded-2xl border px-3.5 py-3 pr-10 text-left transition-all duration-200 ease-out ${
                        active
                          ? "border-transparent bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/10 scale-[1.01]"
                          : "border-slate-100 bg-white text-slate-800 hover:border-orange-200 hover:bg-orange-50/40 hover:scale-[1.005]"
                      }`}
                    >
                      <div className="truncate text-xs font-bold">
                        {session.title}
                      </div>
                      <div
                        className={`mt-1 truncate text-[10px] font-medium leading-relaxed ${
                          active ? "text-orange-50/90" : "text-slate-500"
                        }`}
                      >
                        {session.subtitle}
                      </div>
                      <div
                        className={`mt-1 text-[9px] font-semibold ${
                          active ? "text-orange-100/90" : "text-orange-400"
                        }`}
                      >
                        {formatDate(session.createdAt)}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteSession(session);
                      }}
                      className={`absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-lg border text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                        active
                          ? "border-white/30 text-white hover:bg-white/20 opacity-100"
                          : "border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                      }`}
                      aria-label="Delete conversation"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="xl:col-span-8 2xl:col-span-9">
          <div className="flex h-[70vh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-orange-100/60 bg-white shadow-md sm:h-[72vh] sm:min-h-[560px] xl:min-h-[620px] transition-all duration-300 hover:shadow-lg">
            <header className="border-b border-orange-100/30 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-900 px-4 py-4 text-white sm:px-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-sm font-bold uppercase tracking-wider">
                    AI Assistant
                  </h1>
                  <p className="text-[10px] text-orange-100/80 mt-0.5 font-medium">
                    Hệ thống gợi ý & đặt phòng thông minh
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileHistoryOpen(true)}
                    className="rounded-xl border border-white/35 bg-white/15 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/20 xl:hidden"
                  >
                    Lịch sử
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-orange-50/20 via-white to-orange-50/10 px-4 py-5 sm:px-6">
              {isSelectedSessionLoading && (
                <div className="mb-5 flex justify-center">
                  <div className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs font-medium text-orange-600">
                    Loading conversation...
                  </div>
                </div>
              )}

              {!isSelectedSessionLoading &&
                selectedMessages.map((message) => renderMessage(message))}

              {isSending && (
                <motion.div
                  className="mb-5 flex justify-start"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 400,
                    damping: 30,
                  }}
                >
                  <div className="flex items-end gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                      AI
                    </div>
                    <div className="rounded-2xl rounded-bl-md border border-orange-200 bg-white px-4 py-2 shadow-sm">
                      <div className="flex items-center gap-1.5 text-orange-500">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400" />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {!!latestSuggestionMessage && (
              <div className="border-t border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50/30 to-white px-4 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={toggleSuggestionsAccordion}
                  className="flex w-full items-center justify-between rounded-xl border border-orange-200 bg-white/80 px-3 py-2.5 text-left transition hover:border-orange-300 hover:bg-orange-50"
                  aria-expanded={!isSuggestionsCollapsed}
                  aria-controls="suggested-rooms-panel"
                >
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                      {suggestionLabel}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-orange-700/80">
                      {suggestions.length} suggestion
                      {suggestions.length > 1 ? "s" : ""}
                    </p>
                  </div>

                  <span className="inline-flex items-center justify-center text-orange-700">
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isSuggestionsCollapsed ? "rotate-0" : "rotate-180"
                      }`}
                    />
                  </span>
                </button>

                {!isSuggestionsCollapsed && (
                  <div id="suggested-rooms-panel" className="mt-3">
                    <div className="max-h-[16rem] space-y-2.5 overflow-y-auto pr-1">
                      {showBestMatch && (
                        <div className="mb-2">
                          {renderSuggestionCard(suggestions[0], true)}
                        </div>
                      )}

                      {(showBestMatch ? suggestions.slice(1) : suggestions).map(
                        (s) => renderSuggestionCard(s),
                      )}
                    </div>

                    {suggestions.length > 3 && (
                      <p className="mt-3 flex items-center justify-center text-[10px] font-medium text-orange-600/80">
                        Scroll to view more suggestions
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="sticky bottom-0 z-10 border-t border-orange-100 bg-white/95 backdrop-blur-md px-4 py-3 sm:px-6">
              <div className="relative mb-3 overflow-hidden rounded-2xl border border-orange-100/70 bg-gradient-to-br from-white via-orange-50/25 to-amber-50/30 px-3.5 py-3 shadow-sm">
                <div className="pointer-events-none absolute -right-12 -top-10 h-24 w-24 rounded-full bg-orange-200/20 blur-2xl" />
                <div className="pointer-events-none absolute -left-10 bottom-0 h-16 w-16 rounded-full bg-amber-200/20 blur-2xl" />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                      Quick actions
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                      Vui lòng chọn chức năng: (1) Đặt phòng, (2) Hủy phòng, (3)
                      Gia hạn thời gian, (4) Tra cứu.
                    </p>
                  </div>
                </div>

                <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {activeMenuOptions.length > 0
                    ? activeMenuOptions.map((option) => {
                        const showCode = shouldShowMenuCode(option.code);
                        return (
                          <button
                            key={option.code || option.label}
                            type="button"
                            onClick={() => void handleQuickActionSelect(option)}
                            disabled={isSending || !selectedSession}
                            className="group relative flex flex-col items-start rounded-2xl border border-orange-100 bg-white px-3.5 py-2.5 text-left text-[11px] font-semibold text-slate-800 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {showCode && (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700 mb-1.5 transition-colors group-hover:bg-orange-200">
                                {option.code}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-800">
                              {resolveQuickActionLabel(option)}
                            </span>
                            <span className="mt-1 h-0.5 w-5 rounded-full bg-orange-400 transition-all duration-200 group-hover:w-8" />
                          </button>
                        );
                      })
                    : [
                        { code: "1", label: "Đặt phòng", intent: "BOOK_ROOM" },
                        {
                          code: "2",
                          label: "Hủy phòng",
                          intent: "CANCEL_RESERVATION",
                        },
                        {
                          code: "3",
                          label: "Gia hạn thời gian",
                          intent: "EXTEND_RESERVATION",
                        },
                        { code: "4", label: "Tra cứu", intent: "LOOKUP" },
                      ].map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => void handleQuickActionSelect(option)}
                          disabled={isSending || !selectedSession}
                          className="group relative flex flex-col items-start rounded-2xl border border-orange-100 bg-white px-3.5 py-2.5 text-left text-[11px] font-semibold text-slate-800 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700 mb-1.5 transition-colors group-hover:bg-orange-200">
                            {option.code}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {option.label}
                          </span>
                          <span className="mt-1 h-0.5 w-5 rounded-full bg-orange-400 transition-all duration-200 group-hover:w-8" />
                        </button>
                      ))}
                </div>
              </div>

              {showLookupDetailInput && (
                <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-xs font-semibold text-orange-700">
                    Nhập location code để xem chi tiết phòng
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={lookupLocationCode}
                      onChange={(event) =>
                        setLookupLocationCode(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        void handleLookupDetailSubmit();
                      }}
                      placeholder="VD: A19-003"
                      className="flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                    />
                    <button
                      type="button"
                      onClick={() => void handleLookupDetailSubmit()}
                      disabled={
                        isSending ||
                        !selectedSession ||
                        !lookupLocationCode.trim()
                      }
                      className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
                    >
                      Tra cứu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {isMobileHistoryOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-[1px] xl:hidden">
          <button
            type="button"
            onClick={() => setIsMobileHistoryOpen(false)}
            className="absolute inset-0 h-full w-full"
            aria-label="Close conversations panel"
          />

          <div className="absolute inset-y-0 left-0 w-[86vw] max-w-sm border-r border-orange-200 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-700">
                  Conversations
                </h2>
                <p className="text-xs text-orange-500">UniBot History</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileHistoryOpen(false)}
                className="rounded-lg border border-orange-200 px-2.5 py-1 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
              >
                Close
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleNewChat()}
              disabled={isCreatingChat}
              className="mb-3 w-full rounded-lg border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
            >
              {isCreatingChat ? "Creating..." : "New Chat"}
            </button>

            <div
              className={`space-y-2 pr-1 ${
                shouldEnableConversationScroll
                  ? "max-h-[calc(100vh-11rem)] overflow-y-auto"
                  : ""
              }`}
            >
              {isLoadingHistory && sessions.length === 0 && (
                <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-600">
                  Loading conversations...
                </p>
              )}

              {sessions.map((session) => {
                const active = session.id === selectedSessionId;
                return (
                  <div key={session.id} className="relative">
                    <button
                      type="button"
                      onClick={() => handleSelectSession(session.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 pr-10 text-left transition ${
                        active
                          ? "border-orange-500 bg-orange-500 text-white shadow"
                          : "border-orange-200 bg-white hover:border-orange-300 hover:bg-orange-50"
                      }`}
                    >
                      <div className="truncate text-sm font-semibold">
                        {session.title}
                      </div>
                      <div
                        className={`mt-1 truncate text-xs ${
                          active ? "text-orange-50/85" : "text-orange-700/80"
                        }`}
                      >
                        {session.subtitle}
                      </div>
                      <div
                        className={`mt-1 text-[11px] ${
                          active ? "text-orange-100/80" : "text-orange-500"
                        }`}
                      >
                        {formatDate(session.createdAt)}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteSession(session);
                      }}
                      className={`absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold transition ${
                        active
                          ? "border-white/30 text-white hover:bg-white/10"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                      aria-label="Delete conversation"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="absolute inset-0"
            aria-label="Close image preview"
          />
          <div className="relative z-10 w-full max-w-4xl rounded-2xl bg-white p-2 shadow-2xl">
            <img
              src={previewImageUrl}
              alt="Room preview"
              className="max-h-[80vh] w-full rounded-xl object-contain"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDeleteSession}
        tone="danger"
        title="Delete conversation"
        description={
          pendingDeleteSession
            ? `Delete "${pendingDeleteSession.title}" from chat history? This action cannot be undone.`
            : "Delete this conversation from chat history?"
        }
        confirmText="Delete"
        cancelText="Keep"
        loading={isDeletingSession}
        onClose={() => setPendingDeleteSession(null)}
        onConfirm={handleDeleteSession}
      />

      {deleteToast && (
        <CustomMessage
          type={deleteToast.type}
          message={deleteToast.message}
          onClose={() => setDeleteToast(null)}
        />
      )}
    </motion.section>
  );
};
export default AIAssistantPage;
