// ===== HEADER COMPONENT (UniBooking) =====

import React, { useEffect, useState } from "react";
import { Layout, Button, Typography, Avatar, Dropdown } from "antd";
import {
  BellOutlined,
  UserOutlined,
  LockOutlined,
  LogoutOutlined,
  DownOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";
import {
  useAppDispatch,
  useAppSelector,
  selectLayout,
  selectTheme,
  toggleSidebar,
} from "../../store";
import { ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import type { UserProfile } from "../../types";
import { logout } from "../../services/authService";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { useNotifications } from "../../context/NotificationContext";

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const APP_NAME = "UniBooking";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { mode } = useAppSelector(selectTheme);
  const { sidebarCollapsed } = useAppSelector(selectLayout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false,
  );

  const { notifications, unreadCount, markAllAsRead, markAsRead } =
    useNotifications();

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

  useEffect(() => {
    const onResize = () => {
      setIsMobileView(window.innerWidth < 1024);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  let initials = "";
  let displayName = "";
  let avatarUrl = undefined;
  if (profile) {
    if (profile.firstName && profile.lastName) {
      initials =
        `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
      displayName = `${profile.firstName} ${profile.lastName}`;
    } else if (profile.firstName) {
      initials = profile.firstName[0].toUpperCase();
      displayName = profile.firstName;
    } else if (profile.email) {
      initials = profile.email[0].toUpperCase();
      displayName = profile.email;
    } else {
      initials = "U";
      displayName = "User";
    }
    const profileWithAvatar = profile as UserProfile & { avatar?: string };
    if (profileWithAvatar.avatar) avatarUrl = profileWithAvatar.avatar;
  }

  const userMenuItems: MenuProps["items"] = [
    { key: "1", label: "My Profile", icon: <UserOutlined /> },
    { key: "2", label: "Change Password", icon: <LockOutlined /> },
    { type: "divider" },
    { key: "3", label: "Logout", icon: <LogoutOutlined />, danger: true },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === "1") navigate(ROUTES.PROFILE);
    if (key === "2") navigate(ROUTES.CHANGE_PASSWORD);
    if (key === "3") logout().then(() => (window.location.href = "/login"));
  };

  const latestNotifications = notifications.slice(0, 3);

  const getCategoryBadgeClass = (category?: string) => {
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

  const handleBellClick = () => {
    setIsNotificationOpen((prev) => !prev);
  };

  return (
    <AntHeader
      className={`relative h-auto py-2 px-3 sm:px-4 flex flex-wrap items-center gap-3 ${
        mode === "dark" ? "bg-gray-800" : "bg-white"
      } border-b border-gray-200 shadow-sm`}
      style={{
        background: mode === "dark" ? "#1f2937" : "#ffffff",
      }}
    >
      {/* Left: Mobile menu + Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isMobileView && (
          <Button
            type="text"
            icon={<MenuOutlined className="text-lg" />}
            onClick={() => dispatch(toggleSidebar())}
            aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          />
        )}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: "#ff9500" }}
        >
          <BookOpenIcon className="w-5 h-5 text-white" aria-hidden />
        </div>
        <Text strong className="text-lg hidden sm:inline">
          {APP_NAME}
        </Text>
      </div>

      <div className="flex-1" />

      {/* Right: Notifications + User avatar/login button */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
        <div className="relative">
          <Button
            type="text"
            icon={<BellOutlined className="text-lg" />}
            onClick={handleBellClick}
          />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white border border-white shadow-sm px-0.5">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        {profile ? (
          <div className="flex items-center gap-1">
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(ROUTES.PROFILE)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(ROUTES.PROFILE);
                }
              }}
              className="flex items-center cursor-pointer hover:opacity-90 outline-none p-1"
              title={displayName || "My Profile"}
            >
              <Avatar
                size="default"
                src={avatarUrl}
                style={{ backgroundColor: "#ff9500" }}
                className="flex items-center justify-center"
              >
                {initials}
              </Avatar>
              <span className="ml-2 font-medium text-gray-700 hidden sm:inline">
                {displayName}
              </span>
            </div>
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              arrow
              trigger={["click"]}
            >
              <Button
                type="text"
                icon={<DownOutlined />}
                className="flex items-center justify-center h-8 w-8"
              />
            </Dropdown>
          </div>
        ) : (
          <Button
            type="primary"
            style={{ background: "#ff9500", borderColor: "#ff9500" }}
            onClick={() => navigate(ROUTES.LOGIN)}
            className="rounded-lg ml-2"
          >
            Login
          </Button>
        )}
      </div>

      {isNotificationOpen && (
        <div className="absolute right-2 sm:right-4 top-14 sm:top-16 z-50 w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[360px] md:w-[400px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Notifications
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-orange-600 transition hover:bg-orange-50"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3">
            {latestNotifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                You have no notifications yet.
              </div>
            ) : (
              latestNotifications.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    n.read
                      ? "border-slate-200 bg-white"
                      : "border-orange-200 bg-orange-50"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {n.title}
                    </p>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getCategoryBadgeClass(
                        n.category,
                      )}`}
                    >
                      {getCategoryLabel(n.category)}
                    </span>
                  </div>
                  <p className="max-h-10 overflow-hidden text-xs text-slate-600">
                    {n.message}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {!n.read && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700">
                        New
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsNotificationOpen(false);
              navigate(ROUTES.NOTIFICATIONS);
            }}
            className="w-full border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-orange-600 transition hover:bg-orange-50"
          >
            See All Notifications
          </button>
        </div>
      )}
    </AntHeader>
  );
};

export default Header;
