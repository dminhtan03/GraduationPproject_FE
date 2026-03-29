import React from "react";
import { useNotifications } from "../../context/NotificationContext";
import {
  formatReservationStatusLabel,
  getReservationStatusClass,
} from "../../utils/reservationStatusStyles";

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
};

const NotificationsPage: React.FC = () => {
  const { notifications, markAllAsRead, unreadCount, markAsRead } =
    useNotifications();

  const getCategoryClass = (category?: string) => {
    if (category === "booking") {
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    if (category === "ai") {
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    }
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  };

  const getCategoryLabel = (category?: string) => {
    if (category === "booking") {
      return "Booking";
    }
    if (category === "ai") {
      return "AI";
    }
    return "System";
  };

  return (
    <div className="page-container mx-auto max-w-5xl">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All notifications are read"}
            </p>
          </div>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                unreadCount > 0
                  ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              {unreadCount > 0 ? "Mark all as read" : "All caught up"}
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-slate-500">
          You have no notifications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                n.read
                  ? "border-slate-200 bg-white"
                  : "border-orange-200 bg-orange-50"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                      New
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryClass(
                      n.category,
                    )}`}
                  >
                    {getCategoryLabel(n.category)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(n.createdAt)}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-700">{n.message}</p>

              {(n.reservationId || n.reservationStatusAtNow) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {n.reservationStatusAtNow && (
                    <span
                      className={`rounded-md px-2 py-1 font-medium ${getReservationStatusClass(
                        n.reservationStatusAtNow,
                      )}`}
                    >
                      {formatReservationStatusLabel(n.reservationStatusAtNow)}
                    </span>
                  )}
                </div>
              )}

              {typeof n.progress === "number" && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, n.progress))}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{`${Math.min(100, Math.max(0, n.progress)).toFixed(0)}% Complete`}</span>
                    {n.statusText && (
                      <span className="font-medium">{n.statusText}</span>
                    )}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
