import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Button, Empty, Input, Spin, Tag, Typography } from "antd";
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

const { Title, Text, Paragraph } = Typography;

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
          text: "Xin lỗi, hiện tại AI Assistant đang gặp sự cố. Vui lòng thử lại sau.",
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

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.sender === "user";
    return (
      <div
        key={message.id}
        className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        >
          <Avatar
            size={32}
            style={{
              backgroundColor: isUser ? "#f97316" : "#e5e7eb",
              color: isUser ? "#ffffff" : "#111827",
              fontSize: 12,
            }}
          >
            {isUser ? userInitials : <RobotOutlined />}
          </Avatar>
          <div
            className={`max-w-xl rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
              isUser
                ? "bg-orange-500 text-white rounded-br-none"
                : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
            }`}
          >
            <div>{message.text}</div>
            <div className="mt-1 text-[11px] opacity-70 flex items-center gap-1">
              <ClockCircleOutlined />
              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
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
        className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm min-w-[220px] max-w-xs mr-4 mb-3"
      >
        <div>
          <div className="flex items-center justify-between mb-1">
            <Text strong>{s.locationCode || s.roomId}</Text>
            <Tag color={s.status === "AVAILABLE" ? "green" : "red"}>
              {s.status}
            </Tag>
          </div>
          {typeof s.score === "number" && (
            <div className="text-xs text-gray-500">
              Match score: {s.score.toFixed(2)}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            type="primary"
            size="small"
            className="flex-1 bg-orange-500 border-orange-500"
            onClick={() => handleBookNow(s)}
          >
            Book Now
          </Button>
          <Button size="small" className="flex-1" ghost>
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
    <div className="grid grid-cols-12 gap-6">
      {/* Left: History */}
      <div className="col-span-3">
        <div className="h-full rounded-2xl bg-white border border-gray-200 shadow-sm p-4 flex flex-col">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <Title level={5} className="mb-0">
                History
              </Title>
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleNewChat}
              />
            </div>
            <Input.Search placeholder="Search chats..." size="middle" />
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
                  className={`w-full text-left rounded-xl px-3 py-2 mb-2 border transition-colors ${
                    s.id === selectedSessionId
                      ? "bg-orange-50 border-orange-200"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedSessionId(s.id)}
                >
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {s.title}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {s.subtitle}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer area intentionally left blank (no Manage Preferences) */}
        </div>
      </div>

      {/* Right: Chat area */}
      <div className="col-span-9 flex flex-col">
        <div className="flex-1 rounded-2xl bg-gray-50 border border-gray-200 shadow-sm p-4 flex flex-col">
          {/* Top: current summary */}
          {selectedSession && (
            <div className="mb-4">
              <div className="flex items-center justify-start mb-1">
                <Title level={5} className="mb-0">
                  AI Assistant
                </Title>
              </div>
              <Paragraph type="secondary" className="mb-0 text-sm">
                I can help you find and book study rooms based on your capacity,
                time and location preferences.
              </Paragraph>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pr-2 mb-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Start by telling the assistant what kind of room you need.
              </div>
            ) : (
              messages.map((m) => renderMessage(m))
            )}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Spin size="small" />
                <span>AI Assistant is thinking...</span>
              </div>
            )}
          </div>

          {/* Suggestions list */}
          {suggestions.length > 0 && (
            <div className="mb-4">
              <Text strong className="block mb-2">
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
              onClick={() =>
                handleQuickAction("Check lab availability for this afternoon")
              }
            >
              Check Lab availability
            </Button>
            <Button
              size="small"
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
          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
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
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              loading={isSending}
              onClick={() => handleSend()}
              className="bg-orange-500 border-orange-500 flex-shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
