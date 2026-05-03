import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BellIcon } from "@heroicons/react/24/outline";
import { notificationService } from "../../services/notificationService";
import { ROUTES } from "../../constants";
import { API_CONFIG, STORAGE_KEYS } from "../../constants";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

type NotifItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  reservationId?: string | null;
};

const normalizeSockJsUrl = () => {
  const fallback = "http://localhost:8080/websocket";
  const input = (API_CONFIG.WEBSOCKET_URL || fallback).trim();
  try {
    return /^wss?:\/\//i.test(input) ? input.replace(/^ws/i, "http") : input;
  } catch { return fallback; }
};

const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// start+ admin notification bell
const AdminNotificationBell: React.FC = () => {
  const [adminUserId, setAdminUserId] = useState<string>("");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch own user ID for WebSocket subscription
  useEffect(() => {
    import("../../services/api").then(({ api }) => {
      import("../../constants/endpoints").then(({ API_ENDPOINTS }) => {
        api.get<any>(API_ENDPOINTS.AUTH.PROFILE).then((res) => {
          const data = res.data?.data || res.data;
          if (data?.id) setAdminUserId(String(data.id));
        }).catch(() => {});
      });
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const raw = await notificationService.getAll(0, 30);
      setItems(
        raw.map((r) => ({
          id: String(r.id),
          title: String(r.title || "Notification"),
          content: String(r.content || ""),
          createdAt: String(r.createdAt || new Date().toISOString()),
          isRead: Boolean(r.isRead ?? r.read ?? false),
          reservationId:
            r.reservationId != null ? String(r.reservationId) : null,
        }))
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 15s while mounted
  useEffect(() => {
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  // WebSocket real-time
  useEffect(() => {
    if (!adminUserId) return;
    const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(normalizeSockJsUrl()),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/notifications/${adminUserId}`, () => {
          load();
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [adminUserId, load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = items.filter((i) => !i.isRead).length;

  const handleClick = async (item: NotifItem) => {
    // Mark as read
    if (!item.isRead) {
      try { await notificationService.markAsRead(item.id); } catch { /* ignore */ }
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isRead: true } : i));
    }
    setOpen(false);

    if (item.reservationId) {
      // Service request notifications → admin event booking detail
      if (item.title.toLowerCase().includes("service")) {
        navigate(ROUTES.ADMIN_EVENT_BOOKING_DETAIL.replace(":reservationId", item.reservationId));
      } else {
        navigate(ROUTES.ADMIN_EVENT_BOOKING_DETAIL.replace(":reservationId", item.reservationId));
      }
    }
  };

  const markAllRead = async () => {
    const unreadItems = items.filter((i) => !i.isRead);
    await Promise.allSettled(unreadItems.map((i) => notificationService.markAsRead(i.id)));
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications</p>
            ) : (
              items.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleClick(item)}
                  className={[
                    "w-full px-4 py-3 text-left transition hover:bg-slate-50",
                    !item.isRead ? "bg-orange-50/60" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-semibold ${!item.isRead ? "text-slate-900" : "text-slate-600"}`}>
                      {item.title}
                    </span>
                    {!item.isRead && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.content}</p>
                  <p className="mt-1 text-xs text-slate-400">{timeAgo(item.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationBell;
// end+ admin notification bell
