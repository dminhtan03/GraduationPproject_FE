import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
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
import type {
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
} from "../../types/speech.d";
import {
  BOOKING_CAPACITY_OPTIONS,
  BOOKING_DURATION_OPTIONS,
  BOOKING_ITEM_FALLBACK_IMAGE,
} from "../../constants/aiAssistant";
import {
  buildAssistantStorageKey,
  buildBookingTimeOptions,
  deriveStoredSessions,
  getStoredAssistantState,
  mergeSessionsById,
  resolveBookingRoomCode,
  resolveQuickActionLabel,
} from "../../utils/aiAssistant";
import {
  createId,
  createWelcomeMessage,
  formatClock,
  formatDate,
  formatDateTimeLabel,
  mapDetailMessageToChatMessage,
  mapHistorySessionToSummary,
  statusClass,
  bookingStatusClass,
  getBookingCardData,
  getSpeechRecognitionCtor,
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
    [profile?.id, profile?.email],
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

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
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
  const [bookingImageByCode, setBookingImageByCode] = useState<
    Record<string, string>
  >({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const manualStopRef = useRef(false);
  const keepListeningRef = useRef(false);
  const transcriptRef = useRef("");
  const loadedSessionDetailsRef = useRef<Set<string>>(
    new Set(Object.keys(initialStoredMessagesBySession)),
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
          [session.id]: [createWelcomeMessage()],
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
          [fallbackId]: [createWelcomeMessage()],
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

  const bookingRoomCodes = useMemo(() => {
    const codes = new Set<string>();
    selectedMessages.forEach((message) => {
      (message.bookingItems || []).forEach((item) => {
        const roomCode = resolveBookingRoomCode(item);
        if (roomCode) {
          codes.add(roomCode);
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
                : [createWelcomeMessage()],
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
            [selectedSession.id]: [createWelcomeMessage()],
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

        // Update the active menu options if the response includes them
        if (response.menuOptions && response.menuOptions.length > 0) {
          setActiveMenuOptions(response.menuOptions);
        }
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

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? inputValue).trim();
      if (!content) return;

      if (!text) setInputValue("");
      await sendMessageToAi(content, "chat");
    },
    [inputValue, sendMessageToAi],
  );

  const handleSelectAction = useCallback(
    async (menuOption: AiMenuOption) => {
      if (isSending || !selectedSession) return;
      await sendMessageToAi(menuOption.label, "chat");
    },
    [isSending, selectedSession, sendMessageToAi],
  );

  const handleQuickActionSelect = useCallback(
    async (menuOption: AiMenuOption) => {
      if (isSending || !selectedSession) return;
      await sendMessageToAi(resolveQuickActionLabel(menuOption), "chat");
    },
    [isSending, selectedSession, sendMessageToAi],
  );

  const handleMicClick = useCallback(() => {
    if (isSending || !selectedSession) return;

    if (isListening) {
      manualStopRef.current = true;
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      return;
    }

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setMessagesBySession((prev) => ({
        ...prev,
        [selectedSession.id]: [
          ...(prev[selectedSession.id] ?? []),
          {
            id: createId(),
            sender: "bot",
            text: "Speech recognition is not supported in this browser.",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return;
    }

    const recognition = new RecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    transcriptRef.current = "";
    manualStopRef.current = false;
    keepListeningRef.current = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      const normalizedTranscript = transcript.trim();
      if (normalizedTranscript) {
        transcriptRef.current = normalizedTranscript;
        setInputValue(normalizedTranscript);
      }
    };

    recognition.onerror = () => {
      keepListeningRef.current = false;
      manualStopRef.current = false;
      transcriptRef.current = "";
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (manualStopRef.current) {
        manualStopRef.current = false;
        keepListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;

        const spokenText = transcriptRef.current.trim();
        transcriptRef.current = "";
        if (!spokenText) return;

        setInputValue("");
        void sendMessageToAi(spokenText, "voice");
        return;
      }

      if (keepListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return;
        } catch {
          keepListeningRef.current = false;
        }
      }

      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [isListening, isSending, selectedSession, sendMessageToAi]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [selectedMessages, isSending]);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      manualStopRef.current = false;
      transcriptRef.current = "";
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

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
    const roomDetailImage =
      Array.isArray(roomDetail?.images) && roomDetail.images.length > 0
        ? roomDetail.images[0]
        : null;
    const roomDetailAmenities = Array.isArray(roomDetail?.amenities)
      ? roomDetail.amenities
      : [];
    const roomDetailId = toText(roomDetail?.id);
    const roomDetailLocationCodeRaw = toText(roomDetail?.locationCode);
    const roomDetailLocationCode = roomDetailLocationCodeRaw || "-";
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
    const bookingTimeOptions = buildBookingTimeOptions(message.id);
    const inlineOptions = textNormalized.includes("muốn đặt khi nào")
      ? bookingTimeOptions
      : textNormalized.includes("trong bao lâu")
        ? BOOKING_DURATION_OPTIONS
        : textNormalized.includes("bao nhiêu người")
          ? BOOKING_CAPACITY_OPTIONS
          : [];
    const inlineOptionsLayout = textNormalized.includes("trong bao lâu")
      ? "mt-3 grid grid-cols-3 gap-2"
      : "mt-3 grid grid-cols-2 gap-2";

    return (
      <div
        key={message.id}
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
            className={`max-w-[85vw] sm:max-w-[70vw] xl:max-w-[44rem] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
              isUser
                ? "rounded-br-md bg-orange-500 text-white font-medium"
                : "rounded-bl-md bg-slate-100 text-slate-700"
            }`}
          >
            <div>{message.text}</div>

            {!isUser && inlineOptions.length > 0 && (
              <div className={inlineOptionsLayout}>
                {inlineOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => void sendMessageToAi(option.message, "chat")}
                    disabled={isSending || !selectedSession}
                    className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {!isUser && bookingItems.length > 0 && (
              <div className="mt-3 space-y-3">
                {bookingItems.map((item) => {
                  const roomCode = resolveBookingRoomCode(item);
                  const labelRange = item.label?.split("|")[1]?.trim() || "";
                  const timeRange =
                    item.startTime && item.endTime
                      ? `${item.startTime} - ${item.endTime}`
                      : labelRange;
                  const imageUrl =
                    (roomCode && bookingImageByCode[roomCode]) ||
                    BOOKING_ITEM_FALLBACK_IMAGE;

                  return (
                    <div
                      key={`${item.id}-${roomCode}`}
                      className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
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
                      <div className="p-3">
                        <div className="text-xs font-semibold text-slate-800">
                          {timeRange || item.label || ""}
                        </div>
                        {bookingActionLabel && roomCode && (
                          <button
                            type="button"
                            onClick={() =>
                              void sendMessageToAi(
                                `${bookingActionLabel} ${roomCode}`,
                                "chat",
                              )
                            }
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
              <div className="mt-3 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between gap-2 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
                    Room Detail
                  </p>
                  {roomDetailScore !== null && (
                    <span className="rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-orange-700">
                      Score {roomDetailScore.toFixed(1)}
                    </span>
                  )}
                </div>

                {roomDetailImage && (
                  <button
                    type="button"
                    onClick={() => setPreviewImageUrl(roomDetailImage)}
                    className="block w-full bg-gradient-to-br from-orange-100 to-amber-100"
                  >
                    <img
                      src={roomDetailImage}
                      alt={roomDetailLocationCode}
                      className="h-36 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </button>
                )}

                <div className="space-y-2.5 px-3 py-3 text-[12px] text-slate-700">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600">
                        Room Code
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {roomDetailLocationCode}
                      </p>
                    </div>

                    <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600">
                        Capacity
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {roomDetailCapacity ?? "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 sm:col-span-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">
                        Current User
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {roomDetailCurrentUser || "No active user"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 sm:col-span-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">
                        Check-in Time
                      </p>
                      {roomDetailCheckInLabel ? (
                        <p className="mt-1 font-semibold text-slate-900">
                          {roomDetailCheckInLabel}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] font-medium text-black">
                          No active check-in.
                        </p>
                      )}
                    </div>
                  </div>

                  {roomDetailAmenities.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Amenities
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {roomDetailAmenities.slice(0, 8).map((amenity) => (
                          <span
                            key={`${roomDetailId || roomDetailLocationCode}-${amenity}`}
                            className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-medium text-orange-700"
                          >
                            • {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Feedback
                    </p>

                    {roomDetailFeedbacks.length > 0 ? (
                      <div className="space-y-2">
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
                                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-semibold text-amber-600">
                                    {rating > 0
                                      ? "★".repeat(rating)
                                      : "No rating"}
                                  </div>
                                  {createdAt && (
                                    <span className="text-[10px] text-slate-500">
                                      {formatDateTimeLabel(createdAt)}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[11px] text-slate-700">
                                  {description || "No feedback description."}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[11px] text-slate-600">
                        No feedback available for this room.
                      </p>
                    )}
                  </div>

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
                  {message.menuOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => void handleSelectAction(option)}
                      disabled={isSending}
                      className="flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-left text-[11px] font-semibold text-slate-800 transition hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700">
                        {option.code}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}

            <div className="mt-2 flex items-center gap-1 text-[11px] opacity-70">
              <span>•</span>
              <span>{formatClock(message.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
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

    return (
      <div
        key={`${s.roomId}-${s.locationCode}`}
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 ${
          isFeatured
            ? "border-orange-300 ring-2 ring-orange-200 shadow-md hover:shadow-lg"
            : "border-orange-100 hover:border-orange-200 hover:shadow-md"
        }`}
      >
        {isFeatured && (
          <div className="flex items-center justify-center bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-orange-700">
              Best match for your request
            </span>
          </div>
        )}

        {s.imageUrl && (
          <button
            type="button"
            onClick={() => setPreviewImageUrl(s.imageUrl || null)}
            className="relative block w-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100"
          >
            <img
              src={s.imageUrl}
              alt={s.locationCode || s.roomId}
              className="h-32 w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          </button>
        )}

        <div className="p-3.5 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-slate-900">
                {s.locationCode || s.roomId}
              </h3>
            </div>
            <span
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${
                statusClass[status] ||
                "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {status || "UNKNOWN"}
            </span>
          </div>

          {showMetaGrid && (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {hasBuilding && (
                <div className="rounded-lg border border-orange-100 bg-orange-50/50 px-2 py-2">
                  <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide">
                    Building
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-slate-900">
                    {s.building}
                  </p>
                </div>
              )}

              {hasFloor && (
                <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-2 py-2">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                    Floor
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-slate-900">
                    {s.floor}
                  </p>
                </div>
              )}

              {hasCapacity && (
                <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-2 py-2">
                  <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">
                    Capacity
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-900">
                    {s.capacity}
                  </p>
                </div>
              )}
            </div>
          )}

          {s.availableTimeSlots && s.availableTimeSlots.length > 0 && (
            <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
                Available Time Slots
              </p>
              <p className="mt-1 text-xs text-emerald-900">
                {s.availableTimeSlots.slice(0, 2).join(" • ")}
              </p>
            </div>
          )}

          {s.amenities && s.amenities.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                Amenities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.amenities.slice(0, 5).map((amenity) => (
                  <span
                    key={`${s.roomId}-${amenity}`}
                    className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-medium text-orange-700"
                  >
                    • {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-orange-50 bg-gradient-to-r from-orange-50/40 to-amber-50/40 px-3.5 py-3 sm:px-4">
          <button
            type="button"
            className="flex-1 rounded-lg border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
            onClick={() => handleViewDetails(s)}
          >
            Details
          </button>

          <button
            type="button"
            className="flex-1 rounded-lg border border-orange-500 bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 hover:shadow-md"
            onClick={() => handleBookNow(s)}
          >
            Book Now →
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
          [newSession.id]: [createWelcomeMessage()],
        }));
      }

      setInputValue("");
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
    <section className="ai-assistant-enter relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-3 sm:p-6">
      <div className="pointer-events-none absolute -left-12 top-8 h-40 w-40 rounded-full bg-slate-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-10 h-48 w-48 rounded-full bg-slate-200/50 blur-3xl" />

      <div className="relative grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
        <aside className="hidden xl:col-span-4 xl:block 2xl:col-span-3">
          <div className="flex max-h-[280px] min-h-0 flex-col rounded-2xl bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:max-h-[340px] sm:p-5 xl:max-h-none xl:min-h-[620px]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-700">
                  Conversations
                </h2>
                <p className="text-xs text-orange-500">UniBot History</p>
              </div>
              <button
                type="button"
                onClick={() => void handleNewChat()}
                disabled={isCreatingChat}
                className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
              >
                {isCreatingChat ? "Creating..." : "New Chat"}
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
        </aside>

        <main className="xl:col-span-8 2xl:col-span-9">
          <div className="flex h-[70vh] min-h-[520px] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-sm sm:h-[72vh] sm:min-h-[560px] xl:min-h-[620px]">
            <header className="border-b border-orange-100 bg-gradient-to-r from-orange-500 to-amber-950 px-4 py-4 text-white sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg font-semibold">AI Assistant</h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileHistoryOpen(true)}
                    className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20 xl:hidden"
                  >
                    Conversations
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[11px] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                  <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[11px] font-medium">
                    {selectedSession ? "Active Session" : "New Session"}
                  </span>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-white px-4 py-5 sm:px-6">
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
                <div className="mb-5 flex justify-start">
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
                </div>
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

            <div className="sticky bottom-0 z-10 border-t border-orange-100 bg-white px-4 py-3 sm:px-6">
              <div className="relative mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 px-3 py-3 shadow-sm">
                <div className="pointer-events-none absolute -right-12 -top-10 h-24 w-24 rounded-full bg-sky-200/40 blur-2xl" />
                <div className="pointer-events-none absolute -left-10 bottom-0 h-16 w-16 rounded-full bg-teal-200/40 blur-2xl" />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Quick actions
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Vui lòng chọn chức năng: (1) Đặt phòng, (2) Hủy phòng, (3)
                      Gia hạn thời gian, (4) Tra cứu.
                    </p>
                  </div>
                </div>

                <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {activeMenuOptions.length > 0
                    ? activeMenuOptions.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => void handleQuickActionSelect(option)}
                          disabled={isSending || !selectedSession}
                          className="group relative flex flex-col items-start rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-left text-[11px] font-semibold text-slate-900 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700 mb-1">
                            {option.code}
                          </span>
                          <span className="text-xs font-semibold">
                            {resolveQuickActionLabel(option)}
                          </span>
                          <span className="mt-1 h-0.5 w-6 rounded-full bg-sky-400/60 transition-all duration-200 group-hover:w-9" />
                        </button>
                      ))
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
                          className="group relative flex flex-col items-start rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-left text-[11px] font-semibold text-slate-900 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700 mb-1">
                            {option.code}
                          </span>
                          <span className="text-xs font-semibold">
                            {option.label}
                          </span>
                          <span className="mt-1 h-0.5 w-6 rounded-full bg-sky-400/60 transition-all duration-200 group-hover:w-9" />
                        </button>
                      ))}
                </div>
              </div>

              <div className="flex items-end gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2.5">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your message for UniBot..."
                  className="max-h-28 min-h-10 flex-1 resize-none border-none bg-transparent text-sm text-orange-950 outline-none placeholder:text-orange-400"
                />

                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isSending || !selectedSession}
                  title={isListening ? "Stop recording" : "Speech to text"}
                  className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-1 ${
                    isListening
                      ? "border-red-400 bg-gradient-to-b from-red-500 to-rose-600 text-white shadow-md shadow-red-200"
                      : "border-orange-200 bg-gradient-to-b from-white to-orange-50 text-orange-700 shadow-sm hover:-translate-y-0.5 hover:border-orange-300 hover:shadow"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isListening && (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute -inset-1 animate-pulse rounded-2xl border border-red-300"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute h-3 w-3 animate-ping rounded-full bg-red-200"
                      />
                    </>
                  )}
                  {isListening ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="relative z-10 h-5 w-5"
                    >
                      <rect
                        x="7"
                        y="7"
                        width="10"
                        height="10"
                        rx="2"
                        className="fill-current"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="relative z-10 h-5 w-5"
                    >
                      <path
                        d="M12 3.75a3 3 0 0 0-3 3v5.25a3 3 0 0 0 6 0V6.75a3 3 0 0 0-3-3Z"
                        className="fill-current"
                      />
                      <path
                        d="M5.25 10.5a.75.75 0 0 1 .75.75V12a6 6 0 0 0 12 0v-.75a.75.75 0 0 1 1.5 0V12a7.5 7.5 0 0 1-6.75 7.46V21a.75.75 0 0 1-1.5 0v-1.54A7.5 7.5 0 0 1 4.5 12v-.75a.75.75 0 0 1 .75-.75Z"
                        className="fill-current"
                      />
                    </svg>
                  )}
                  <span className="sr-only">
                    {isListening ? "Stop recording" : "Start voice input"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isSending || !inputValue.trim() || !selectedSession}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300 shadow-sm"
                  aria-label="Send"
                >
                  {isSending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                    </svg>
                  )}
                </button>
              </div>

              {isListening && (
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  Listening... Speak now.
                </p>
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
    </section>
  );
};
export default AIAssistantPage;
