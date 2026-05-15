import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CloseOutlined, MessageOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { aiService } from "../../services/aiService";
import type { AiChatResponseDto, AiRoomSuggestion } from "../../types/api";
import type { Reservation, UserProfile } from "../../types";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { ROUTES } from "../../constants";
import { roomService } from "../../services/roomService";

type Sender = "user" | "bot";

interface ChatBubbleMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
  suggestions?: AiRoomSuggestion[];
  reservation?: Reservation | null;
  reservationCreated?: boolean;
  roomDetail?: Record<string, unknown> | null;
}

const createId = () => Math.random().toString(36).slice(2);
const toText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const AI_WIDGET_STORAGE_KEY = "ai_widget_chat_state_v1";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpeechRecognitionAlternativeLike>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getSpeechRecognitionCtor = () => {
  const maybeWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return maybeWindow.SpeechRecognition || maybeWindow.webkitSpeechRecognition;
};

interface StoredWidgetState {
  messages: ChatBubbleMessage[];
  aiSessionId: string | null;
  hasGreeted: boolean;
}

const toPositiveNumber = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

const toNumberOrNull = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const formatDateTimeLabel = (value: unknown) => {
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

const bookingStatusClass = (status: string) => {
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

const getBookingCardData = (reservation?: Reservation | null) => {
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

export const AiChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [dismissedSuggestionMessageId, setDismissedSuggestionMessageId] =
    useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const manualStopRef = useRef(false);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AI_WIDGET_STORAGE_KEY);
      if (!raw) {
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredWidgetState>;
      if (Array.isArray(parsed.messages)) {
        setMessages(parsed.messages);
      }

      if (
        typeof parsed.aiSessionId === "string" ||
        parsed.aiSessionId === null
      ) {
        setAiSessionId(parsed.aiSessionId ?? null);
      }

      if (typeof parsed.hasGreeted === "boolean") {
        setHasGreeted(parsed.hasGreeted);
      }
    } catch {
      // Ignore invalid storage payload.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const payload: StoredWidgetState = {
      messages,
      aiSessionId,
      hasGreeted,
    };

    window.localStorage.setItem(AI_WIDGET_STORAGE_KEY, JSON.stringify(payload));
  }, [aiSessionId, hasGreeted, isHydrated, messages]);

  useEffect(() => {
    if (!isHydrated || !isOpen || hasGreeted || messages.length > 0) return;
    const now = new Date().toISOString();
    setMessages([
      {
        id: createId(),
        sender: "bot",
        text: "Hello! I am UniBot. I can help you find available rooms and book faster.",
        createdAt: now,
      },
    ]);
    setHasGreeted(true);
  }, [hasGreeted, isHydrated, isOpen, messages.length]);

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

  let userInitials = "U";
  if (profile) {
    if (profile.firstName && profile.lastName) {
      userInitials = `${profile.firstName[0] ?? ""}${
        profile.lastName[0] ?? ""
      }`.toUpperCase();
    } else if (profile.firstName) {
      userInitials = profile.firstName[0].toUpperCase();
    } else if (profile.email) {
      userInitials = profile.email[0].toUpperCase();
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const sendMessageToAi = useCallback(
    async (content: string, _mode: "chat" | "voice") => {
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

        if (response.sessionId) {
          setAiSessionId(response.sessionId);
        }

        const botMessage: ChatBubbleMessage = {
          id: createId(),
          sender: "bot",
          text: response.reply,
          createdAt: new Date().toISOString(),
          suggestions: response.suggestions,
          reservation: response.reservation,
          reservationCreated: response.reservationCreated,
          roomDetail: response.roomDetail as Record<string, unknown> | null | undefined,
        };
        setMessages((prev) => [...prev, botMessage]);
      } catch {
        const botMessage: ChatBubbleMessage = {
          id: createId(),
          sender: "bot",
          text: "Sorry, UniBot is unavailable right now. Please try again later.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } finally {
        setIsSending(false);
      }
    },
    [aiSessionId, isSending],
  );

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const content = (overrideText ?? inputValue).trim();
      if (!content) return;

      if (!overrideText) {
        setInputValue("");
      }

      await sendMessageToAi(content, "chat");
    },
    [inputValue, sendMessageToAi],
  );

  const handleMicClick = useCallback(() => {
    if (isSending) return;

    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          sender: "bot",
          text: "Speech recognition is not supported in this browser.",
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    const recognition = new RecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      finalTranscript = transcript.trim();
      if (finalTranscript) {
        setInputValue(finalTranscript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (manualStopRef.current) {
        manualStopRef.current = false;
        return;
      }

      const spokenText = finalTranscript.trim();
      if (!spokenText) return;

      setInputValue("");
      void sendMessageToAi(spokenText, "voice");
    };

    recognition.start();
  }, [isListening, isSending, sendMessageToAi]);

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

  const handleViewBookingDetail = (reservation?: Reservation | null) => {
    const source = toRecord(reservation);
    if (!source) return;

    const bookingId = toText(source.id) || toText(source.reservationId);
    if (!bookingId) return;

    navigate(ROUTES.BOOKING_DETAIL.replace(":bookingId", bookingId), {
      state: { booking: reservation },
    });
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-50 flex max-h-[74vh] w-80 flex-col overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-xl md:right-6 md:w-96">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white">
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm">UniBot Assistant</span>
              <span className="text-[11px] text-white/80">
                {aiSessionId ? "Session active" : "Online"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/15"
              aria-label="Close chat"
            >
              <CloseOutlined />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-orange-50/30 px-3 py-3">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-orange-600">
                Ask UniBot about available rooms, equipment, or quick booking.
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.sender === "user";
                const booking = getBookingCardData(m.reservation);
                const bookingId =
                  toText(m.reservation?.id) ||
                  toText(m.reservation?.rawData?.reservationId);
                return (
                  <div
                    key={m.id}
                    className={`mb-2 flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isUser ? "bg-orange-500 text-white" : "bg-orange-50 border border-orange-400 text-orange-600 shadow-sm"}`}
                      >
                        {isUser ? userInitials : "AI"}
                      </div>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm transition-all ${isUser ? "rounded-br-none bg-orange-500 text-white font-medium" : "rounded-bl-none bg-slate-100 text-slate-700"}`}
                      >
                        {m.text}

                        {/* Room Detail Card */}
                        {!isUser && m.roomDetail && (() => {
                          const rd = m.roomDetail as Record<string, unknown>;
                          const rdImages = Array.isArray(rd.images) ? rd.images as string[] : [];
                          const rdAmenities = Array.isArray(rd.amenities) ? rd.amenities as string[] : [];
                          const rdCode = toText(rd.locationCode) || toText(rd.id) || "-";
                          const rdCapacity = toNumberOrNull(rd.capacity);
                          const rdScore = toNumberOrNull(rd.score);
                          const rdCurrentUser = toText(rd.currentUserName);
                          const rdCheckIn = toText(rd.checkInTime);
                          const rdFeedbacks = Array.isArray(rd.feedbacks) ? rd.feedbacks as Record<string, unknown>[] : [];
                          const rdId = toText(rd.id);
                          return (
                            <div className="mt-2 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-md">
                              <div className="flex items-center justify-between gap-2 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-2.5 py-2">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Room Detail</span>
                                {rdScore !== null && (
                                  <span className="rounded-lg border border-orange-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-orange-700">
                                    Score {rdScore.toFixed(1)}
                                  </span>
                                )}
                              </div>

                              {rdImages[0] && (
                                <button type="button" onClick={() => setPreviewImageUrl(rdImages[0])} className="block w-full">
                                  <img src={rdImages[0]} alt={rdCode} className="h-20 w-full object-cover" loading="lazy" />
                                </button>
                              )}

                              <div className="space-y-1.5 px-2.5 py-2 text-[10px] text-slate-700">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-2 py-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-orange-600">Room Code</p>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-900">{rdCode}</p>
                                  </div>
                                  <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-2 py-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-orange-600">Capacity</p>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-900">{rdCapacity ?? "-"}</p>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5">
                                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-600">Current User</p>
                                  <p className="mt-0.5 text-xs font-semibold text-slate-900">{rdCurrentUser || "No active user"}</p>
                                </div>

                                {rdCheckIn && (
                                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-600">Check-in</p>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-900">{formatDateTimeLabel(rdCheckIn)}</p>
                                  </div>
                                )}

                                {rdAmenities.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {rdAmenities.slice(0, 5).map((a) => (
                                      <span key={`${rdId}-${a}`} className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium text-orange-700">• {a}</span>
                                    ))}
                                  </div>
                                )}

                                {rdFeedbacks.length > 0 && (
                                  <div className="space-y-1">
                                    {rdFeedbacks.slice(0, 2).map((fb, i) => {
                                      const rating = typeof fb.rating === "number" ? Math.max(0, Math.min(5, Math.round(fb.rating))) : 0;
                                      const desc = toText(fb.description);
                                      return (
                                        <div key={toText(fb.id) || `fb-${i}`} className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1">
                                          <div className="text-[10px] font-semibold text-amber-600">{rating > 0 ? "★".repeat(rating) : "No rating"}</div>
                                          {desc && <p className="mt-0.5 text-[9px] text-slate-700">{desc}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {(rdId || rdCode !== "-") && (
                                  <div className="flex justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleViewDetails({ roomId: rdId || "", locationCode: rdCode, status: "AVAILABLE", capacity: rdCapacity ?? undefined, amenities: rdAmenities.length > 0 ? rdAmenities : undefined, imageUrl: rdImages[0] || undefined })}
                                      className="rounded-lg border border-orange-500 bg-orange-500 px-2.5 py-1 text-[9px] font-semibold text-white transition hover:bg-orange-600"
                                    >
                                      View Room →
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Booking Details Card */}
                        {!isUser && (booking || m.reservationCreated) && (
                          <div className="mt-2 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-md hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between gap-2 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-2.5 py-2">
                              <span className="font-bold uppercase tracking-wide text-orange-700 text-[10px]">
                                Booking Details
                              </span>
                              <span
                                className={`rounded-lg border px-2 py-0.5 text-[9px] font-semibold ${bookingStatusClass(
                                  booking?.status || "CREATED",
                                )}`}
                              >
                                {booking?.status || "CREATED"}
                              </span>
                            </div>

                            {booking ? (
                              <div className="space-y-2 px-2.5 py-2.5 text-[10px] text-slate-700">
                                <div className="sm:hidden rounded-lg border border-orange-100 bg-orange-50/50 px-2 py-2">
                                  <p className="font-bold text-slate-900 text-xs">
                                    {booking.roomCode}
                                  </p>
                                  <p className="mt-0.5 text-[9px] text-slate-600">
                                    {booking.buildingName} · {booking.floorName}
                                  </p>
                                  <p className="mt-1 text-[9px] font-semibold text-slate-900">
                                    {booking.startTime} - {booking.endTime}
                                  </p>
                                </div>

                                <div className="hidden sm:grid grid-cols-1 gap-1.5">
                                  <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-2 py-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-orange-600">
                                      Room
                                    </p>
                                    <p className="mt-0.5 font-semibold text-slate-900 text-xs">
                                      {booking.roomCode}
                                    </p>
                                  </div>

                                  <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-2 py-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-orange-600">
                                      Location
                                    </p>
                                    <p className="mt-0.5 font-semibold text-slate-900 text-xs">
                                      {booking.buildingName} ·{" "}
                                      {booking.floorName}
                                    </p>
                                  </div>

                                  <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-2 py-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-orange-600">
                                      Schedule
                                    </p>
                                    <p className="mt-0.5 font-semibold text-slate-900 text-xs">
                                      {booking.startTime} - {booking.endTime}
                                    </p>
                                  </div>
                                </div>

                                {booking.attendeeCount && (
                                  <span className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-semibold text-blue-700">
                                    {booking.attendeeCount} attendees
                                  </span>
                                )}

                                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5">
                                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-600">
                                    Purpose
                                  </p>
                                  <p className="mt-0.5 text-slate-900 text-xs">
                                    {booking.purpose}
                                  </p>
                                </div>

                                {booking.note && (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-2 py-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-amber-700">
                                      Note
                                    </p>
                                    <p className="mt-0.5 text-amber-900 text-xs">
                                      {booking.note}
                                    </p>
                                  </div>
                                )}

                                <div className="flex justify-end pt-1">
                                  {bookingId && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleViewBookingDetail(m.reservation)
                                      }
                                      className="rounded-lg border border-orange-500 bg-orange-500 px-2.5 py-1 text-[9px] font-semibold text-white shadow-sm transition hover:bg-orange-600 hover:shadow-md"
                                    >
                                      View Details →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="px-2.5 py-2 text-[10px] text-orange-900">
                                Reservation has been created successfully.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {isSending && (
              <div className="mb-2 flex justify-start">
                <div className="flex flex-row items-end gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-semibold text-orange-700">
                    AI
                  </div>
                  <div className="rounded-2xl rounded-bl-none border border-orange-200 bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-1.5">
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

            {isSuggestionsVisible && (
              <div className="mt-2 rounded-xl border border-orange-200 bg-white p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                    Suggested Rooms
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setDismissedSuggestionMessageId(
                        latestSuggestionMessage?.id ?? null,
                      )
                    }
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-orange-200 text-[10px] text-orange-600 transition hover:border-orange-300 hover:bg-orange-50"
                    aria-label="Close suggested rooms"
                  >
                    <CloseOutlined />
                  </button>
                </div>

                {isSingleSuggestion && (
                  <p className="mb-2 inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                    Best match
                  </p>
                )}

                <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                  {latestSuggestions.map((item) => (
                    <div
                      key={`${item.roomId}-${item.locationCode}`}
                      className="rounded-lg border border-orange-100 px-2 py-1.5"
                    >
                      {item.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImageUrl(item.imageUrl || null)
                          }
                          className="mb-1 block w-full"
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.locationCode || item.roomId}
                            className="h-20 w-full rounded-md object-cover"
                            loading="lazy"
                          />
                        </button>
                      )}

                      <div className="truncate text-xs font-semibold text-orange-900">
                        {item.locationCode || item.roomId}
                      </div>
                      <div className="mt-0.5 text-[11px] text-orange-700/90">
                        {item.building || "Unknown building"}
                        {item.floor ? ` · ${item.floor}` : ""}
                        {typeof item.capacity === "number"
                          ? ` · Capacity ${item.capacity}`
                          : ""}
                      </div>
                      <div className="mt-1.5 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(item)}
                          className="rounded border border-orange-200 px-2 py-0.5 text-[10px] font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBookNow(item)}
                          className="rounded bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-orange-600"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {latestSuggestions.length > 3 && (
                  <p className="mt-1.5 text-[10px] text-orange-600/90">
                    Scroll to view more rooms.
                  </p>
                )}
              </div>
            )}

            {previewImageUrl && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4">
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="absolute inset-0"
                  aria-label="Close image preview"
                />
                <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-2 shadow-2xl">
                  <img
                    src={previewImageUrl}
                    alt="Room preview"
                    className="max-h-[70vh] w-full rounded-lg object-contain"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPreviewImageUrl(null)}
                      className="rounded border border-orange-200 px-2.5 py-1 text-[10px] font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-orange-200 bg-white px-3 py-2">


            <div className="flex items-end gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                className="min-h-9 max-h-24 flex-1 resize-none rounded-lg border border-orange-200 px-2.5 py-2 text-xs text-orange-950 outline-none placeholder:text-orange-400 focus:border-orange-300"
              />

              <button
                type="button"
                onClick={handleMicClick}
                disabled={isSending}
                title={isListening ? "Stop recording" : "Speech to text"}
                className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-1 ${
                  isListening
                    ? "border-red-400 bg-gradient-to-b from-red-500 to-rose-600 text-white shadow-md shadow-red-200"
                    : "border-orange-200 bg-gradient-to-b from-white to-orange-50 text-orange-700 shadow-sm hover:-translate-y-0.5 hover:border-orange-300 hover:shadow"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isListening && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute -inset-1 animate-pulse rounded-[10px] border border-red-300"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-red-200"
                    />
                  </>
                )}
                {isListening ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className="relative z-10 h-4 w-4"
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
                    className="relative z-10 h-4 w-4"
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
                disabled={isSending || !inputValue.trim()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300 shadow-sm"
                aria-label="Send"
              >
                {isSending ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
                )}
              </button>
            </div>

            {isListening && (
              <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-red-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                Listening... speak now.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl px-4 py-3 flex items-center gap-2 transition-all hover:scale-105"
      >
        <MessageOutlined className="text-lg" />
        <span className="hidden sm:inline text-sm font-semibold">
          Ask UniBot
        </span>
      </button>
    </>
  );
};

export default AiChatWidget;
