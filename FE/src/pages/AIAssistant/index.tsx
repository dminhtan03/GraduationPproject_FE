import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Avatar, Button, Empty, Input, Tag, Typography } from "antd";
import {
  ClockCircleOutlined,
  PlusOutlined,
  SendOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { aiService } from "../../services/aiService";
import type { AiChatResponseDto, AiRoomSuggestion } from "../../types/api";
import type { Reservation, UserProfile } from "../../types";
import { ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";

const { Text } = Typography;

type Sender = "user" | "bot";

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
  suggestions?: AiRoomSuggestion[];
  reservation?: Reservation | null;
  reservationCreated?: boolean;
}

interface ChatSessionSummary {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
}

const createId = () => Math.random().toString(36).slice(2);

const formatClock = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

const AIAssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([
    {
      id: "s1",
      title: "Finding Epsilon Rooms",
      subtitle: "Found 3 available rooms for you.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("s1");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const latestBotMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(
          (m) =>
            m.sender === "bot" && m.suggestions && m.suggestions.length > 0,
        ),
    [messages],
  );

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

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? inputValue).trim();
      if (!content) return;

      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: createId(),
        sender: "user",
        text: content,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMessage]);
      if (!text) setInputValue("");

      setIsSending(true);
      try {
        const response: AiChatResponseDto = await aiService.chat({
          message: content,
        });

        const botMessage: ChatMessage = {
          id: createId(),
          sender: "bot",
          text: response.reply,
          createdAt: new Date().toISOString(),
          suggestions: response.suggestions,
          reservation: response.reservation,
          reservationCreated: response.reservationCreated,
        };
        setMessages((prev) => [...prev, botMessage]);
      } catch {
        const botMessage: ChatMessage = {
          id: createId(),
          sender: "bot",
          text: "Sorry, I'm currently experiencing some issues. Please try again later.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } finally {
        setIsSending(false);
      }
    },
    [inputValue],
  );

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt);
  };

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isSending]);

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.sender === "user";
    return (
      <div
        key={message.id}
        className={`mb-5 flex ${isUser ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        >
          <Avatar
            size={32}
            style={{
              backgroundColor: isUser ? "#ea580c" : "#fed7aa",
              color: isUser ? "#ffffff" : "#9a3412",
              fontSize: 12,
            }}
          >
            {isUser ? userInitials : <RobotOutlined />}
          </Avatar>
          <div
            className={`max-w-[min(78vw,44rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
              isUser
                ? "rounded-br-md bg-orange-500 text-orange-50"
                : "rounded-bl-md border border-orange-200 bg-white text-orange-900"
            }`}
          >
            <div>{message.text}</div>
            <div className="mt-2 flex items-center gap-1 text-[11px] opacity-70">
              <ClockCircleOutlined />
              <span>{formatClock(message.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleBookNow = (suggestion: AiRoomSuggestion) => {
    if (!suggestion.roomId) return;
    navigate(ROUTES.BOOK_ROOM.replace(":roomId", suggestion.roomId));
  };

  const renderSuggestionCard = (s: AiRoomSuggestion) => {
    return (
      <div
        key={s.roomId}
        className="mb-3 mr-3 flex min-w-[220px] max-w-xs flex-col justify-between rounded-2xl border border-orange-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Text strong>{s.locationCode || s.roomId}</Text>
            <Tag
              color={s.status === "AVAILABLE" ? "green" : "red"}
              className="mr-0"
            >
              {s.status}
            </Tag>
          </div>
          {typeof s.score === "number" && (
            <div className="text-xs text-orange-700/80">
              Match score: {s.score.toFixed(2)}
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="primary"
            size="small"
            className="flex-1 border-orange-500 bg-orange-500"
            onClick={() => handleBookNow(s)}
          >
            Book Now
          </Button>
          <Button
            size="small"
            className="flex-1 border-orange-200 text-orange-700"
            ghost
          >
            Quick Reserve
          </Button>
        </div>
      </div>
    );
  };

  const suggestions = latestBotMessage?.suggestions || [];

  const handleNewChat = () => {
    const id = createId();
    const now = new Date().toISOString();
    const newSession: ChatSessionSummary = {
      id,
      title: "New Chat",
      subtitle: "Start a new conversation",
      createdAt: now,
    };
    setSessions((prev) => [newSession, ...prev]);
    setSelectedSessionId(id);
    setMessages([]);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-orange-200/80 bg-gradient-to-br from-orange-50 via-amber-50/50 to-white p-4 sm:p-6">
      <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-orange-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-amber-200/45 blur-3xl" />

      <div className="relative grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left: History */}
        <div className="xl:col-span-4 2xl:col-span-3">
          <div className="flex h-full flex-col rounded-3xl border border-orange-200/70 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="mb-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-orange-900">
                  History
                </h2>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleNewChat}
                  className="text-orange-700"
                />
              </div>
              <Input.Search
                placeholder="Search chats..."
                size="middle"
                className="rounded-xl"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {sessions.length === 0 ? (
                <Empty
                  description="No conversations yet"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`mb-2.5 w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                      s.id === selectedSessionId
                        ? "border-orange-500 bg-orange-500 text-orange-50 shadow"
                        : "border-orange-200 bg-white hover:border-orange-300 hover:bg-orange-50"
                    }`}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <div className="truncate text-sm font-semibold">
                      {s.title}
                    </div>
                    <div
                      className={`truncate text-xs ${
                        s.id === selectedSessionId
                          ? "text-orange-100/85"
                          : "text-orange-700/75"
                      }`}
                    >
                      {s.subtitle}
                    </div>
                    <div
                      className={`mt-1 text-[11px] ${
                        s.id === selectedSessionId
                          ? "text-orange-100/70"
                          : "text-orange-700/60"
                      }`}
                    >
                      {formatDate(s.createdAt)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat area */}
        <div className="xl:col-span-8 2xl:col-span-9">
          <div className="flex h-[72vh] min-h-[560px] flex-col overflow-hidden rounded-3xl border border-orange-200/80 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
            {/* Top: current summary */}
            {selectedSession && (
              <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50/70 px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <RobotOutlined className="text-orange-700" />
                  <h2 className="text-base font-semibold text-orange-900">
                    AI Assistant
                  </h2>
                </div>
                <p className="text-xs text-orange-700/80">
                  Ask for room suggestions, available slots, and booking
                  guidance.
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="mb-4 flex-1 overflow-y-auto pr-2">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-orange-300 bg-orange-50/60 p-6 text-center">
                  <RobotOutlined className="mb-2 text-xl text-orange-400" />
                  <p className="text-sm text-orange-700/80">
                    Start by telling the assistant what kind of room you need.
                  </p>
                </div>
              ) : (
                messages.map((m) => renderMessage(m))
              )}
              {isSending && (
                <div className="mb-4 flex justify-start">
                  <div className="flex flex-row items-end gap-3">
                    <Avatar
                      size={32}
                      style={{
                        backgroundColor: "#fed7aa",
                        color: "#9a3412",
                        fontSize: 12,
                      }}
                    >
                      <RobotOutlined />
                    </Avatar>
                    <div className="max-w-xs rounded-2xl rounded-bl-md border border-orange-200 bg-white px-4 py-2 text-sm leading-relaxed text-orange-900 shadow-sm">
                      <span className="typing-dots">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions list */}
            {suggestions.length > 0 && (
              <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-3.5">
                <Text strong className="mb-2 block text-orange-900">
                  Suggested rooms
                </Text>
                <div className="flex flex-wrap">
                  {suggestions.map((s) => renderSuggestionCard(s))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                size="small"
                className="rounded-full border-orange-200 bg-white text-orange-800 hover:border-orange-300 hover:text-orange-900"
                onClick={() =>
                  handleQuickAction("Check lab availability for this afternoon")
                }
              >
                Check Lab availability
              </Button>
              <Button
                size="small"
                className="rounded-full border-orange-200 bg-white text-orange-800 hover:border-orange-300 hover:text-orange-900"
                onClick={() =>
                  handleQuickAction(
                    "Show me available rooms in the Epsilon building",
                  )
                }
              >
                Show me map of Epsilon
              </Button>
              <Button
                size="small"
                className="rounded-full border-orange-200 bg-white text-orange-800 hover:border-orange-300 hover:text-orange-900"
                onClick={() =>
                  handleQuickAction(
                    "How do I book a group study room for 5 people?",
                  )
                }
              >
                How to book for a group?
              </Button>
            </div>

            {/* Input bar */}
            <div className="flex items-end gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 p-2.5">
              <Input.TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                autoSize={{ minRows: 1, maxRows: 3 }}
                placeholder="Type a message to find rooms..."
                className="border-none bg-transparent shadow-none"
              />
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                loading={isSending}
                onClick={() => handleSend()}
                className="h-10 w-10 shrink-0 border-orange-500 bg-orange-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
