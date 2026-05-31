import React, { useCallback, useEffect } from "react";
import { Badge, Avatar, Typography, Tag, Image, Tooltip } from "antd";
import {
  RobotOutlined,
  CloseOutlined,
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
import { useNavigate } from "react-router-dom";
import { useAiChat, DEFAULT_MENU_OPTIONS } from "../../hooks/useAiChat";
import type { AiRoomSuggestion } from "../../types/api";
import {
  resolveBookingRoomCode,
  CAPACITY_RANGE_OPTIONS,
  type BookingTimeMode,
  getAvailableTimeSlots,
} from "../../utils/aiAssistant";
import { ROUTES } from "../../constants";

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
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const {
    messages,
    isSending,
    isHydrated,
    aiSessionId,
    userInitials,
    messagesEndRef,
    latestSuggestions,
    isSuggestionsVisible,
    suggestionLabel,
    showBestMatch,
    latestSuggestionMessage,
    // Actions
    setDismissedSuggestionMessageId,
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
    // Interactive states & helpers
    bookingImageByCode,
    bookingTimeUiByMessage,
    lookupLocationCode,
    bookingDayOptions,
    showLookupDetailInput,
    setLookupLocationCode,
    sendMessageToAi,
    updateBookingTimeState,
    handleLookupDetailSubmit,
    handleCapacityRangeSelect,
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

  const shouldShowMenuCode = (code?: string | number | null) => {
    const value = String(code ?? "").trim();
    return value.length > 0 && value.length <= 3;
  };

  const renderMenuOptions = (msgMenuOptions?: typeof DEFAULT_MENU_OPTIONS) => {
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
        {options.map((option) => {
          const showCode = shouldShowMenuCode(option.code);
          return (
            <button
              key={option.code || option.label}
              type="button"
              onClick={() => void sendMessageToAi(option.label)}
              disabled={isSending}
              className="wcw-menu-option"
            >
              {showCode && (
                <span className="wcw-menu-option__code">{option.code}</span>
              )}
              <span className="wcw-menu-option__label">{option.label}</span>
            </button>
          );
        })}
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

  const renderBookingItems = (bookingItems?: any[]) => {
    if (!bookingItems || bookingItems.length === 0) return null;

    return (
      <div className="wcw-booking-items-list" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {bookingItems.map((item, index) => {
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
            "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800";
          const bookingItemId = item.id || "";

          let statusBadge = null;
          if (statusPart) {
            let statusColorClasses = "wcw-status--default";
            if (statusPart.toLowerCase().includes("không đến")) {
              statusColorClasses = "wcw-status--absent";
            } else if (statusPart.toLowerCase().includes("hủy")) {
              statusColorClasses = "wcw-status--cancelled";
            } else if (
              statusPart.toLowerCase().includes("đã") ||
              statusPart.toLowerCase().includes("hoạt động")
            ) {
              statusColorClasses = "wcw-status--active";
            }

            statusBadge = (
              <span className={`wcw-item-status-badge ${statusColorClasses}`}>
                {statusPart}
              </span>
            );
          }

          return (
            <div
              key={`${bookingItemId}-${roomCode}-${index}`}
              onClick={() => {
                if (bookingItemId) {
                  navigate(ROUTES.BOOKING_DETAIL.replace(":bookingId", bookingItemId), {
                    state: { booking: item },
                  });
                }
              }}
              className="wcw-booking-item-card"
              style={{
                cursor: bookingItemId ? "pointer" : "default",
                display: "flex",
                gap: 8,
                padding: 8,
                borderRadius: 12,
                border: "1px solid #f0f0f0",
                backgroundColor: "#fff",
                transition: "all 0.2s",
              }}
            >
              <img
                src={imageUrl}
                alt={roomCode}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#262626" }}>{roomCode}</span>
                  {statusBadge}
                </div>
                <span style={{ fontSize: 10, color: "#8c8c8c", marginTop: 2 }}>{timeRange}</span>
                {item.purpose && (
                  <span style={{ fontSize: 10, color: "#595959", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.purpose}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBookingTimePrompt = (messageId: string) => {
    const bookingTimeState = bookingTimeUiByMessage[messageId] ?? {
      mode: "quick" as BookingTimeMode,
      dayIndex: 0,
      time: "",
      manualMessage: "",
    };

    const activeBookingDay =
      bookingDayOptions[bookingTimeState.dayIndex] || bookingDayOptions[0];
    const availableTimeSlots = getAvailableTimeSlots(
      activeBookingDay.offsetDays,
      new Date(),
    );
    const resolvedBookingTime =
      bookingTimeState.time || availableTimeSlots[0] || "";

    return (
      <div className="wcw-booking-time-picker" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#8c8c8c" }}>Ngày</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 4 }}>
            {bookingDayOptions.map((day, index) => {
              const isActive = index === bookingTimeState.dayIndex;
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => {
                    updateBookingTimeState(messageId, (current) => {
                      const nextDay =
                        bookingDayOptions[index] || bookingDayOptions[0];
                      const nextSlots = getAvailableTimeSlots(
                        nextDay.offsetDays,
                        new Date(),
                      );
                      const shouldAutoPick = nextDay.offsetDays === 0;
                      const nextTime = shouldAutoPick
                        ? nextSlots[0] || ""
                        : current.time;
                      const resolvedTime = nextSlots.includes(current.time)
                        ? current.time
                        : nextTime;

                      return {
                        ...current,
                        dayIndex: index,
                        time: resolvedTime,
                      };
                    });
                  }}
                  className={`wcw-day-btn ${isActive ? "wcw-day-btn--active" : ""}`}
                >
                  <div style={{ fontWeight: "bold" }}>{day.label}</div>
                  <div style={{ fontSize: 9, opacity: 0.8 }}>{day.dateLabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#8c8c8c" }}>Giờ bắt đầu</span>
          {availableTimeSlots.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 4,
                marginTop: 4,
                maxHeight: 120,
                overflowY: "auto",
                padding: "2px 0",
              }}
            >
              {availableTimeSlots.map((time) => {
                const isActive = time === resolvedBookingTime;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() =>
                      updateBookingTimeState(messageId, (current) => ({
                        ...current,
                        time,
                      }))
                    }
                    className={`wcw-time-slot-btn ${isActive ? "wcw-time-slot-btn--active" : ""}`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#8c8c8c", marginTop: 4 }}>
              Hôm nay đã hết khung giờ trống.
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ffe7ba",
            backgroundColor: "#fffbe6",
          }}
        >
          <span style={{ fontSize: 11, color: "#d48806", fontWeight: "medium" }}>
            {resolvedBookingTime
              ? `Đặt lúc ${resolvedBookingTime} — ${activeBookingDay.label}`
              : "Chọn giờ bắt đầu"}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!resolvedBookingTime) return;
              void sendMessageToAi(`${activeBookingDay.label} lúc ${resolvedBookingTime}`);
            }}
            disabled={!resolvedBookingTime || isSending}
            className="wcw-confirm-btn"
          >
            Xác nhận
          </button>
        </div>
      </div>
    );
  };

  const renderDurationPrompt = (messageId: string) => {
    const DURATION_STEP = 30;
    const DURATION_MIN = 30;
    const DURATION_MAX = 480;
    const currentMinutes =
      bookingTimeUiByMessage[messageId]?.durationMinutes ?? 60;
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    const durationLabel =
      hours > 0 && mins > 0
        ? `${hours} tiếng ${mins} phút`
        : hours > 0
          ? `${hours} tiếng`
          : `${mins} phút`;

    return (
      <div className="wcw-duration-picker" style={{ marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid #f0f0f0", backgroundColor: "#fff" }}>
        <span style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#8c8c8c" }}>Chọn thời lượng</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <input
            type="range"
            min={DURATION_MIN}
            max={DURATION_MAX}
            step={DURATION_STEP}
            value={currentMinutes}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateBookingTimeState(messageId, (current) => ({
                ...current,
                durationMinutes: val,
              }));
            }}
            style={{ flex: 1, accentColor: "#ff7a45" }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 9, color: "#bfbfbf" }}>30 phút</span>
          <span className="wcw-duration-badge">{durationLabel}</span>
          <span style={{ fontSize: 9, color: "#bfbfbf" }}>8 tiếng</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={() => void sendMessageToAi(durationLabel)}
            disabled={isSending}
            className="wcw-confirm-btn"
          >
            Xác nhận
          </button>
        </div>
      </div>
    );
  };

  const renderCapacityOptions = (isLookup = false) => {
    return (
      <div className="wcw-capacity-options" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginTop: 8 }}>
        {CAPACITY_RANGE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              if (isLookup) {
                void handleCapacityRangeSelect(option.label);
              } else {
                void sendMessageToAi(option.message);
              }
            }}
            disabled={isSending}
            className="wcw-capacity-btn"
          >
            {option.label}
          </button>
        ))}
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

                  // Extract prompt detection logic matching AIAssistant page
                  const textNormalized = toText(m.text).toLowerCase();
                  const isBookingTimePrompt = !isUser && textNormalized.includes("muốn đặt khi nào");
                  const isLookupCapacityPrompt =
                    !isUser &&
                    (textNormalized.includes("khoảng sức chứa") ||
                      textNormalized.includes("nhập sức chứa"));
                  const isDurationPrompt =
                    !isUser &&
                    (textNormalized.includes("trong bao lâu") ||
                      textNormalized.includes("thêm bao lâu"));
                  const isCapacityPrompt = !isUser && textNormalized.includes("bao nhiêu người");
                  const isNoCapacityMatchPrompt =
                    !isUser &&
                    (textNormalized.includes("không tìm thấy phòng phù hợp") ||
                      textNormalized.includes("không tìm thấy phòng nào phù hợp") ||
                      textNormalized.includes("không có phòng phù hợp")) &&
                    textNormalized.includes("người");

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

                          {/* Booking Time Selection Picker Prompt */}
                          {isBookingTimePrompt && renderBookingTimePrompt(m.id)}

                          {/* Capacity Selection Buttons Prompts */}
                          {isLookupCapacityPrompt && renderCapacityOptions(true)}
                          {isCapacityPrompt && !isNoCapacityMatchPrompt && renderCapacityOptions(false)}
                          {isNoCapacityMatchPrompt && renderCapacityOptions(false)}

                          {/* Duration Selection Slider Prompt */}
                          {isDurationPrompt && renderDurationPrompt(m.id)}

                          {/* Booking Item Grids / Lists */}
                          {!isUser && m.bookingItems && renderBookingItems(m.bookingItems)}

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

            {/* Lookup Location Code Drawer */}
            {showLookupDetailInput && (
              <div className="wcw-lookup-panel animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="wcw-lookup-panel__title">
                  Nhập location code để xem chi tiết
                </span>
                <div className="wcw-lookup-panel__row">
                  <input
                    value={lookupLocationCode}
                    onChange={(e) => setLookupLocationCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleLookupDetailSubmit();
                      }
                    }}
                    placeholder="VD: A19-003"
                    className="wcw-lookup-panel__input"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLookupDetailSubmit()}
                    disabled={isSending || !lookupLocationCode.trim()}
                    className="wcw-lookup-panel__btn"
                  >
                    Tra cứu
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions Bar */}
            <div className="wcw-quick-actions">
              <div className="wcw-quick-actions__label">
                <ThunderboltOutlined /> Quick actions
              </div>
              <div className="wcw-quick-actions__grid">
                {DEFAULT_MENU_OPTIONS.map((option) => (
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

