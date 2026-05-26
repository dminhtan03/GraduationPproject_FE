export const AI_ASSISTANT_STORAGE_KEY = "ai_assistant_messages_v2";
export const AI_ASSISTANT_GUEST_KEY = "guest";

export const QUICK_ACTION_LABELS: Record<string, string> = {
  BOOK_ROOM: "Đặt phòng",
  CANCEL_RESERVATION: "Hủy phòng",
  EXTEND_RESERVATION: "Gia hạn thời gian",
  LOOKUP: "Tra cứu",
};

export const BOOKING_ITEM_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800";

export const BOOKING_DURATION_OPTIONS = [
  "1 tiếng",
  "1 tiếng rưỡi",
  "1 tiếng 40 phút",
  "2 tiếng",
  "2 tiếng 30 phút",
  "2 tiếng 50 phút",
  "3 tiếng",
].map((label) => ({
  label,
  message: label,
}));

export const BOOKING_CAPACITY_OPTIONS = [5, 10, 15, 20, 25, 30].map(
  (people) => ({
    label: `${people} người`,
    message: `${people} người`,
  }),
);
