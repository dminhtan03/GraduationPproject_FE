import React, { useCallback, useEffect, useState } from "react";
import { Button, Input } from "antd";
import {
  CloseOutlined,
  MessageOutlined,
  RobotOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { aiService } from "../../services/aiService";
import type { AiChatResponseDto } from "../../types/api";

type Sender = "user" | "bot";

interface ChatBubbleMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
}

const createId = () => Math.random().toString(36).slice(2);

export const AiChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);

  useEffect(() => {
    if (!isOpen || hasGreeted) return;
    const now = new Date().toISOString();
    setMessages([
      {
        id: createId(),
        sender: "bot",
        text: "Hello! I'm UniBot. I can help you find available rooms or book quickly.",
        createdAt: now,
      },
    ]);
    setHasGreeted(true);
  }, [isOpen, hasGreeted]);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const content = (overrideText ?? inputValue).trim();
      if (!content) return;

      const now = new Date().toISOString();
      const userMessage: ChatBubbleMessage = {
        id: createId(),
        sender: "user",
        text: content,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMessage]);
      if (!overrideText) setInputValue("");

      setIsSending(true);
      try {
        const response: AiChatResponseDto = await aiService.chat({
          message: content,
        });

        const botMessage: ChatBubbleMessage = {
          id: createId(),
          sender: "bot",
          text: response.reply,
          createdAt: new Date().toISOString(),
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
    [inputValue],
  );

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:right-6 w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-orange-500 text-white">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <RobotOutlined />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-sm">UniBot Assistant</span>
                <span className="text-[11px] text-white/80">Online</span>
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-white/80"
            />
          </div>

          {/* Messages */}
          <div className="flex-1 px-3 py-3 overflow-y-auto bg-gray-50">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 text-center px-4">
                Ask UniBot about available rooms, equipment, or quick booking.
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex mb-2 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                        isUser
                          ? "bg-orange-500 text-white rounded-br-none"
                          : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-3 py-2 bg-white flex items-center gap-2">
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
              placeholder="Ask UniBot..."
              className="text-xs"
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
      )}

      {/* Floating bubble */}
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 flex items-center gap-2 rounded-full bg-orange-500 text-white shadow-lg px-3 py-2 hover:bg-orange-600 transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <RobotOutlined />
        </span>
        <span className="hidden sm:inline text-sm font-semibold">
          Ask UniBot
        </span>
        <MessageOutlined className="inline sm:hidden" />
      </button>
    </>
  );
};

export default AiChatWidget;
