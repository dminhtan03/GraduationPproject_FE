import React, { useCallback, useEffect } from "react";
import { Badge, Avatar, Tooltip, Typography, Tag, Image } from "antd";
import {
  RobotOutlined,
  CloseOutlined,
  SendOutlined,
  EyeOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  UserOutlined,
  StarFilled,
  TeamOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useAiChat } from "../../hooks/useAiChat";
import type { AiRoomSuggestion } from "../../types/api";

import "../../styles/AiChatWidget.css";

const { Text, Title } = Typography;

// ── Animations ────────────────────────────────────────────────────────────────

const widgetVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 340, damping: 28 },
  },
  exit: {
    opacity: 0,
    y: 24,
    scale: 0.92,
    transition: { duration: 0.18 },
  },
};

const bubbleVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 30 },
  },
};

const fabVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.08 },
  tap: { scale: 0.94 },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const AiChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const {
    messages,
    inputValue,
    isSending,
    isHydrated,
    aiSessionId,
    userInitials,
    messagesEndRef,
    menuOptions,
    latestSuggestions,
    isSuggestionsVisible,
    suggestionLabel,
    showBestMatch,
    latestSuggestionMessage,
    // Actions
    setInputValue,
    setDismissedSuggestionMessageId,
    handleSend,
    handleQuickAction,
    handleBookNow,
    handleViewDetails,
    handleViewBookingDetail,
    greetIfNeeded,
    scrollToBottom,
    // Helpers
    getBookingCardData,
    bookingStatusClass,
    formatDateTimeLabel,
    toText,
    toNumberOrNull,
  } = useAiChat();

  // Greet on first open
  useEffect(() => {
    if (isOpen && isHydrated) greetIfNeeded();
  }, [isOpen, isHydrated, greetIfNeeded]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isSending, isOpen, scrollToBottom]);

  const toggleOpen = useCallback(() => setIsOpen((p) => !p), []);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderMenuOptions = (msgMenuOptions?: typeof menuOptions) => {
    const options =
      msgMenuOptions && msgMenuOptions.length > 0 ? msgMenuOptions : null;
    if (!options) return null;

    return (
      <motion.div
        className="wcw-menu-options"
        variants={bubbleVariants}
        initial="hidden"
        animate="visible"
      >
        {options.map((option) => (
          <button
            key={option.code}
            type="button"
            onClick={() => void handleQuickAction(option)}
            disabled={isSending}
            className="wcw-menu-option"
          >
            <span className="wcw-menu-option__code">{option.code}</span>
            <span className="wcw-menu-option__label">{option.label}</span>
          </button>
        ))}
      </motion.div>
    );
  };

  const renderRoomDetailCard = (rd: Record<string, unknown>) => {
    const rdImages = Array.isArray(rd.images) ? (rd.images as string[]) : [];
    const rdAmenities = Array.isArray(rd.amenities)
      ? (rd.amenities as string[])
      : [];
    const rdCode = toText(rd.locationCode) || toText(rd.id) || "-";
    const rdCapacity = toNumberOrNull(rd.capacity);
    const rdScore = toNumberOrNull(rd.score);
    const rdCurrentUser = toText(rd.currentUserName);
    const rdCheckIn = toText(rd.checkInTime);
    const rdFeedbacks = Array.isArray(rd.feedbacks)
      ? (rd.feedbacks as Record<string, unknown>[])
      : [];
    const rdId = toText(rd.id);

    return (
      <div className="wcw-card wcw-card--detail">
        <div className="wcw-card__header">
          <Text className="wcw-card__title">
            <InfoCircleOutlined /> Room Detail
          </Text>
          {rdScore !== null && (
            <Tag color="gold" className="wcw-card__tag">
              <StarFilled /> {rdScore.toFixed(1)}
            </Tag>
          )}
        </div>

        {rdImages[0] && (
          <Image
            src={rdImages[0]}
            alt={rdCode}
            className="wcw-card__image"
            preview={{ mask: <EyeOutlined /> }}
            height={80}
            width="100%"
            style={{ objectFit: "cover" }}
          />
        )}

        <div className="wcw-card__body">
          <div className="wcw-card__grid">
            <div className="wcw-card__field">
              <Text type="secondary" className="wcw-card__label">
                Room Code
              </Text>
              <Text strong className="wcw-card__value">
                {rdCode}
              </Text>
            </div>
            <div className="wcw-card__field">
              <Text type="secondary" className="wcw-card__label">
                Capacity
              </Text>
              <Text strong className="wcw-card__value">
                {rdCapacity ?? "-"}
              </Text>
            </div>
          </div>

          <div className="wcw-card__field">
            <Text type="secondary" className="wcw-card__label">
              <UserOutlined /> Current User
            </Text>
            <Text strong className="wcw-card__value">
              {rdCurrentUser || "No active user"}
            </Text>
          </div>

          {rdCheckIn && (
            <div className="wcw-card__field">
              <Text type="secondary" className="wcw-card__label">
                Check-in
              </Text>
              <Text strong className="wcw-card__value">
                {formatDateTimeLabel(rdCheckIn)}
              </Text>
            </div>
          )}

          {rdAmenities.length > 0 && (
            <div className="wcw-card__amenities">
              {rdAmenities.slice(0, 5).map((a) => (
                <Tag key={`${rdId}-${a}`} className="wcw-tag--amenity">
                  {a}
                </Tag>
              ))}
            </div>
          )}

          {rdFeedbacks.length > 0 && (
            <div className="wcw-card__feedbacks">
              {rdFeedbacks.slice(0, 2).map((fb, i) => {
                const rating =
                  typeof fb.rating === "number"
                    ? Math.max(0, Math.min(5, Math.round(fb.rating)))
                    : 0;
                const desc = toText(fb.description);
                return (
                  <div
                    key={toText(fb.id) || `fb-${i}`}
                    className="wcw-card__feedback-item"
                  >
                    <Text className="wcw-feedback-stars">
                      {rating > 0 ? "★".repeat(rating) : "No rating"}
                    </Text>
                    {desc && <Text className="wcw-feedback-desc">{desc}</Text>}
                  </div>
                );
              })}
            </div>
          )}

          {(rdId || rdCode !== "-") && (
            <div className="wcw-card__actions">
              <button
                type="button"
                onClick={() =>
                  handleViewDetails({
                    roomId: rdId || "",
                    locationCode: rdCode,
                    status: "AVAILABLE",
                    capacity: rdCapacity ?? undefined,
                    amenities: rdAmenities.length > 0 ? rdAmenities : undefined,
                    imageUrl: rdImages[0] || undefined,
                  })
                }
                className="wcw-btn wcw-btn--primary wcw-btn--sm"
              >
                View Room →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBookingCard = (
    booking: ReturnType<typeof getBookingCardData>,
    reservation: import("../../types").Reservation | null | undefined,
    reservationCreated?: boolean,
  ) => {
    if (!booking && !reservationCreated) return null;
    const bookingId =
      toText(reservation?.id) || toText(reservation?.rawData?.reservationId);

    return (
      <div className="wcw-card wcw-card--booking">
        <div className="wcw-card__header">
          <Text className="wcw-card__title">
            <CalendarOutlined /> Booking Details
          </Text>
          <Tag
            className={`wcw-card__status ${bookingStatusClass(booking?.status || "CREATED")}`}
          >
            {booking?.status || "CREATED"}
          </Tag>
        </div>

        {booking ? (
          <div className="wcw-card__body">
            <div className="wcw-card__field">
              <Text type="secondary" className="wcw-card__label">
                <EnvironmentOutlined /> Room
              </Text>
              <Text strong className="wcw-card__value">
                {booking.roomCode}
              </Text>
            </div>

            <div className="wcw-card__grid">
              <div className="wcw-card__field">
                <Text type="secondary" className="wcw-card__label">
                  Location
                </Text>
                <Text className="wcw-card__value">
                  {booking.buildingName} · {booking.floorName}
                </Text>
              </div>
              <div className="wcw-card__field">
                <Text type="secondary" className="wcw-card__label">
                  Schedule
                </Text>
                <Text className="wcw-card__value">
                  {booking.startTime} – {booking.endTime}
                </Text>
              </div>
            </div>

            {booking.attendeeCount && (
              <Tag
                icon={<TeamOutlined />}
                color="blue"
                className="wcw-tag--inline"
              >
                {booking.attendeeCount} attendees
              </Tag>
            )}

            <div className="wcw-card__field">
              <Text type="secondary" className="wcw-card__label">
                <FileTextOutlined /> Purpose
              </Text>
              <Text className="wcw-card__value">{booking.purpose}</Text>
            </div>

            {booking.note && (
              <div className="wcw-card__field wcw-card__field--note">
                <Text type="secondary" className="wcw-card__label">
                  Note
                </Text>
                <Text className="wcw-card__value">{booking.note}</Text>
              </div>
            )}

            {bookingId && (
              <div className="wcw-card__actions">
                <button
                  type="button"
                  onClick={() => handleViewBookingDetail(reservation)}
                  className="wcw-btn wcw-btn--primary wcw-btn--sm"
                >
                  View Details →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="wcw-card__body">
            <Text className="wcw-card__success-text">
              Reservation has been created successfully.
            </Text>
          </div>
        )}
      </div>
    );
  };

  const renderSuggestionItem = (item: AiRoomSuggestion) => {
    const metaParts = [
      item.building,
      item.floor,
      typeof item.capacity === "number" ? `Capacity ${item.capacity}` : "",
    ]
      .map((v) => (typeof v === "string" ? v.trim() : v))
      .filter(Boolean) as string[];

    return (
      <motion.div
        key={`${item.roomId}-${item.locationCode}`}
        className="wcw-suggestion-item"
        variants={bubbleVariants}
        initial="hidden"
        animate="visible"
      >
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt={item.locationCode || item.roomId}
            className="wcw-suggestion-item__img"
            preview={{ mask: <EyeOutlined /> }}
            height={64}
            width="100%"
            style={{ objectFit: "cover", borderRadius: 8 }}
          />
        )}
        <Text strong className="wcw-suggestion-item__name">
          {item.locationCode || item.roomId}
        </Text>
        {metaParts.length > 0 && (
          <Text type="secondary" className="wcw-suggestion-item__meta">
            {metaParts.join(" · ")}
          </Text>
        )}
        <div className="wcw-suggestion-item__actions">
          <button
            type="button"
            onClick={() => handleViewDetails(item)}
            className="wcw-btn wcw-btn--ghost wcw-btn--xs"
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => handleBookNow(item)}
            className="wcw-btn wcw-btn--primary wcw-btn--xs"
          >
            Book
          </button>
        </div>
      </motion.div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="wcw-panel"
            variants={widgetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="wcw-header">
              <div className="wcw-header__left">
                <Avatar
                  size={32}
                  icon={<RobotOutlined />}
                  className="wcw-header__avatar"
                />
                <div className="wcw-header__info">
                  <Title level={5} className="wcw-header__title">
                    UniBot Assistant
                  </Title>
                  <Badge
                    status="success"
                    text={
                      <span className="wcw-header__status">
                        {aiSessionId ? "Session active" : "Online"}
                      </span>
                    }
                  />
                </div>
              </div>
              <Tooltip title="Close">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="wcw-header__close"
                  aria-label="Close chat"
                >
                  <CloseOutlined />
                </button>
              </Tooltip>
            </div>

            {/* Messages */}
            <div className="wcw-messages">
              {messages.length === 0 ? (
                <div className="wcw-messages__empty">
                  <RobotOutlined className="wcw-messages__empty-icon" />
                  <Text type="secondary">
                    Ask UniBot about available rooms, equipment, or quick
                    booking.
                  </Text>
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.sender === "user";
                  const booking = getBookingCardData(m.reservation);
                  return (
                    <motion.div
                      key={m.id}
                      className={`wcw-bubble-row ${isUser ? "wcw-bubble-row--user" : "wcw-bubble-row--bot"}`}
                      variants={bubbleVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div
                        className={`wcw-bubble-group ${isUser ? "wcw-bubble-group--user" : "wcw-bubble-group--bot"}`}
                      >
                        <Avatar
                          size={24}
                          className={
                            isUser ? "wcw-avatar--user" : "wcw-avatar--bot"
                          }
                        >
                          {isUser ? userInitials : "AI"}
                        </Avatar>

                        <div
                          className={`wcw-bubble ${isUser ? "wcw-bubble--user" : "wcw-bubble--bot"}`}
                        >
                          <Text className="wcw-bubble__text">{m.text}</Text>

                          {/* Inline Menu Options from bot message */}
                          {!isUser && renderMenuOptions(m.menuOptions)}

                          {/* Room Detail */}
                          {!isUser &&
                            m.roomDetail &&
                            renderRoomDetailCard(
                              m.roomDetail as Record<string, unknown>,
                            )}

                          {/* Booking Card */}
                          {!isUser &&
                            (booking || m.reservationCreated) &&
                            renderBookingCard(
                              booking,
                              m.reservation,
                              m.reservationCreated,
                            )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}

              {/* Typing indicator */}
              {isSending && (
                <motion.div
                  className="wcw-bubble-row wcw-bubble-row--bot"
                  variants={bubbleVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="wcw-bubble-group wcw-bubble-group--bot">
                    <Avatar size={24} className="wcw-avatar--bot">
                      AI
                    </Avatar>
                    <div className="wcw-bubble wcw-bubble--bot">
                      <div className="wcw-typing">
                        <span className="wcw-typing__dot" />
                        <span
                          className="wcw-typing__dot"
                          style={{ animationDelay: "0.15s" }}
                        />
                        <span
                          className="wcw-typing__dot"
                          style={{ animationDelay: "0.3s" }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Suggestions Panel */}
              <AnimatePresence>
                {isSuggestionsVisible && (
                  <motion.div
                    className="wcw-suggestions"
                    variants={bubbleVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <div className="wcw-suggestions__header">
                      <Text strong className="wcw-suggestions__title">
                        <ThunderboltOutlined /> {suggestionLabel}
                      </Text>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedSuggestionMessageId(
                            latestSuggestionMessage?.id ?? null,
                          )
                        }
                        className="wcw-suggestions__close"
                        aria-label="Dismiss suggestions"
                      >
                        <CloseOutlined />
                      </button>
                    </div>

                    {showBestMatch && (
                      <Tag color="volcano" className="wcw-tag--best-match">
                        ✨ Best match
                      </Tag>
                    )}

                    <div className="wcw-suggestions__list">
                      {latestSuggestions.map((item) =>
                        renderSuggestionItem(item),
                      )}
                    </div>

                    {latestSuggestions.length > 3 && (
                      <Text type="secondary" className="wcw-suggestions__hint">
                        Scroll to view more rooms
                      </Text>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Bar */}
            <div className="wcw-quick-actions">
              <div className="wcw-quick-actions__label">
                <ThunderboltOutlined /> Quick actions
              </div>
              <div className="wcw-quick-actions__grid">
                {menuOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => void handleQuickAction(option)}
                    disabled={isSending}
                    className="wcw-quick-action"
                  >
                    <span className="wcw-quick-action__code">
                      {option.code}
                    </span>
                    <span className="wcw-quick-action__text">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="wcw-input-area">
              <div className="wcw-input-area__row">
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
                  placeholder="Nhập tin nhắn cho UniBot..."
                  className="wcw-input-area__textarea"
                />

                <Tooltip title="Send">
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={isSending || !inputValue.trim()}
                    className="wcw-btn-icon wcw-btn-icon--send"
                    aria-label="Send"
                  >
                    {isSending ? (
                      <span className="wcw-spinner" />
                    ) : (
                      <SendOutlined />
                    )}
                  </button>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Action Button ─────────────────────────── */}
      <motion.button
        type="button"
        onClick={toggleOpen}
        className="wcw-fab"
        variants={fabVariants}
        initial="idle"
        whileHover="hover"
        whileTap="tap"
        aria-label="Open UniBot"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <CloseOutlined style={{ fontSize: 20 }} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="wcw-fab__content"
            >
              <MessageOutlined style={{ fontSize: 22 }} />
              <span className="wcw-fab__label">Ask UniBot</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
};

export default AiChatWidget;
