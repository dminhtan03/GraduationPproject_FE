export type NotificationCategoryOptions = {
  includeEvent?: boolean;
};

export type NotificationTimeStyle = "compact" | "long";

export const formatNotificationTime = (
  iso: string,
  style: NotificationTimeStyle = "compact",
): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return "Just now";

  if (diffMinutes < 60) {
    return style === "compact"
      ? `${diffMinutes}m ago`
      : `${diffMinutes} mins ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return style === "compact"
      ? `${diffHours}h ago`
      : `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (style === "compact" && diffDays >= 7) {
    return date.toLocaleDateString();
  }

  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
};

export const getNotificationCategoryClass = (
  category?: string,
  options: NotificationCategoryOptions = {},
): string => {
  if (category === "booking") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  if (options.includeEvent && category === "event") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
  if (category === "ai") {
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  }
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
};

export const getNotificationCategoryLabel = (
  category?: string,
  options: NotificationCategoryOptions = {},
): string => {
  if (category === "booking") return "Booking";
  if (options.includeEvent && category === "event") return "Event";
  if (category === "ai") return "AI";
  return "System";
};
