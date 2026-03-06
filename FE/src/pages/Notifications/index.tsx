import React from "react";
import { useNotifications } from "../../context/NotificationContext";

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
  const { notifications, markAllAsRead, unreadCount } = useNotifications();

  return (
    <div className="page-container flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Notifications
          </h1>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-sm text-orange-500 hover:text-orange-600 hover:underline"
            >
              {unreadCount > 0 ? "Mark all as read" : "All caught up"}
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            You have no notifications yet.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-5 py-4 ${
                  n.read ? "bg-white" : "bg-orange-50/60"
                }`}
              >
                <div
                  className={`mt-1 w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                    n.category === "batch"
                      ? "bg-orange-100 text-orange-500"
                      : n.category === "ai"
                        ? "bg-blue-100 text-blue-500"
                        : n.category === "booking"
                          ? "bg-green-100 text-green-500"
                          : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {n.category === "batch" && <span>↻</span>}
                  {n.category === "ai" && <span>🤖</span>}
                  {n.category === "booking" && <span>✓</span>}
                  {!n.category && <span>•</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 truncate">
                      {n.title}
                    </p>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {formatTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{n.message}</p>
                  {typeof n.progress === "number" && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, n.progress))}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <span>{`${Math.min(100, Math.max(0, n.progress)).toFixed(0)}% Complete`}</span>
                        {n.statusText && <span>{n.statusText}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
