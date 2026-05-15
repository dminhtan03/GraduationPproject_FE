import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { useNotifications } from "../../context/NotificationContext";
import { api } from "../../services/api";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import CustomPagination from "../../components/common/CustomPagination";
import {
  formatNotificationTime,
  getNotificationCategoryClass,
  getNotificationCategoryLabel,
} from "../../utils/notificationHelpers";
import {
  formatReservationStatusLabel,
  getReservationStatusClass,
} from "../../utils/reservationStatusStyles";

const EVENT_KEYWORDS = ["event", "invitation", "invite", "participant"];
const NOTIFICATION_PAGE_SIZE = 10;

const isEventNotification = (
  title: string,
  message: string,
  category?: string,
) => {
  if (category === "event") return true;
  const source = `${title} ${message}`.toLowerCase();
  return EVENT_KEYWORDS.some((keyword) => source.includes(keyword));
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, markAllAsRead, unreadCount, markAsRead } =
    useNotifications();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  const showToast = (type: MessageType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) =>
        current && current.message === message ? null : current,
      );
    }, 3000);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(notifications.length / NOTIFICATION_PAGE_SIZE),
  );
  const pagedNotifications = useMemo(
    () =>
      notifications.slice(
        page * NOTIFICATION_PAGE_SIZE,
        (page + 1) * NOTIFICATION_PAGE_SIZE,
      ),
    [notifications, page],
  );

  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const respondEventInvitation = async (
    participantId: string,
    response: "ACCEPT" | "DECLINE",
    notificationId: string,
  ) => {
    if (!participantId) return;
    setActionLoadingId(notificationId);
    try {
      await api.put(
        buildUrl(API_ENDPOINTS.EVENTS.RESPOND_INVITATION, { participantId }),
        { response },
      );
      showToast(
        "success",
        response === "ACCEPT" ? "Đã chấp nhận tham gia" : "Đã từ chối tham gia",
      );
      markAsRead(notificationId);
    } catch {
      showToast("error", "Unable to respond invitation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleNotificationItemClick = (notificationId: string) => {
    const notification = notifications.find(
      (item) => item.id === notificationId,
    );
    markAsRead(notificationId);

    if (!notification) return;

    const isEvent = isEventNotification(
      notification.title,
      notification.message,
      notification.category,
    );
    const eventReservationId =
      notification.eventReservationId || notification.reservationId;
    if (isEvent && eventReservationId) {
      navigate(
        ROUTES.EVENT_LIVE.replace(
          ":reservationId",
          encodeURIComponent(eventReservationId),
        ),
      );
      return;
    }

    const bookingId = notification?.reservationId?.trim();
    if (!bookingId) {
      return;
    }

    navigate(
      ROUTES.BOOKING_DETAIL.replace(
        ":bookingId",
        encodeURIComponent(bookingId),
      ),
      {
        state: {
          booking: {
            id: bookingId,
            status: notification?.reservationStatusAtNow,
            rawData: {
              reservationStatusAtNow: notification?.reservationStatusAtNow,
              status: notification?.reservationStatusAtNow,
            },
          },
        },
      },
    );
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
          {pagedNotifications.map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => handleNotificationItemClick(n.id)}
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
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getNotificationCategoryClass(
                      n.category,
                      { includeEvent: true },
                    )}`}
                  >
                    {getNotificationCategoryLabel(n.category, {
                      includeEvent: true,
                    })}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatNotificationTime(n.createdAt, "long")}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-700">{n.message}</p>

              {isEventNotification(n.title, n.message, n.category) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {(() => {
                    const inviteStatus = String(
                      n.inviteStatus || "",
                    ).toUpperCase();
                    const showInviteActions =
                      Boolean(n.participantId) &&
                      (inviteStatus === "INVITED" || !inviteStatus);
                    if (!showInviteActions) return null;
                    return (
                      <>
                        <button
                          type="button"
                          disabled={actionLoadingId === n.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void respondEventInvitation(
                              n.participantId || "",
                              "ACCEPT",
                              n.id,
                            );
                          }}
                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === n.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void respondEventInvitation(
                              n.participantId || "",
                              "DECLINE",
                              n.id,
                            );
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}

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
      {notifications.length > 0 && (
        <CustomPagination
          currentPage={page + 1}
          totalPages={totalPages}
          onPageChange={(nextPage) => setPage(nextPage - 1)}
          totalItems={notifications.length}
          pageSize={NOTIFICATION_PAGE_SIZE}
          className="mt-6"
        />
      )}
      {toast && (
        <CustomMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
