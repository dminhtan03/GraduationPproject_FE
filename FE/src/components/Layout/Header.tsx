// ===== HEADER COMPONENT (UniBooking) =====

import React, { useEffect, useState } from "react";
import {
  Layout,
  Button,
  Typography,
  Input,
  Avatar,
  Dropdown,
  AutoComplete,
  Spin,
} from "antd";
import {
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  DownOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";
import { useAppSelector, selectTheme } from "../../store";
import { ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import type { Room, UserProfile } from "../../types";
import { logout } from "../../services/authService";
import { roomService } from "../../services/roomService";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { useNotifications } from "../../context/NotificationContext";

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const APP_NAME = "UniBooking";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useAppSelector(selectTheme);

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Search state
  const [searchValue, setSearchValue] = useState("");
  interface RoomSearchOption {
    value: string;
    label: React.ReactNode;
    room: Room;
  }
  const [searchResults, setSearchResults] = useState<RoomSearchOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const { notifications, unreadCount, markAllAsRead } = useNotifications();

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

  // Search handler
  const handleSearchRoom = async (value: string) => {
    setSearchValue(value);
    if (!value || value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      // Lấy tất cả phòng, filter theo roomName hoặc building
      const res = await roomService.getRooms({ page: 0, size: 50 });
      const keyword = value.trim().toLowerCase();
      const filtered = res.items.filter(
        (r) =>
          r.roomName.toLowerCase().includes(keyword) ||
          (r.building && r.building.toLowerCase().includes(keyword)),
      );
      setSearchResults(
        filtered.map((r) => ({
          value: r.roomName + " - " + r.building,
          label: (
            <div>
              <span className="font-semibold">{r.roomName}</span>
              <span className="text-xs text-gray-500 ml-2">{r.building}</span>
            </div>
          ),
          room: r,
        })),
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectRoom = (value: string, option: RoomSearchOption) => {
    // Điều hướng tới trang chi tiết/đặt phòng theo roomId
    if (option?.room?.id) {
      navigate(ROUTES.BOOK_ROOM.replace(":roomId", option.room.id));
    }
    setSearchValue("");
    setSearchResults([]);
  };

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
    { key: "2", label: "Settings", icon: <SettingOutlined /> },
    { type: "divider" },
    { key: "3", label: "Logout", icon: <LogoutOutlined />, danger: true },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === "1") navigate(ROUTES.PROFILE);
    if (key === "2") navigate(ROUTES.PROFILE_EDIT);
    if (key === "3") logout().then(() => (window.location.href = "/login"));
  };

  const latestNotifications = notifications.slice(0, 3);

  const handleBellClick = () => {
    setIsNotificationOpen((prev) => !prev);
  };

  return (
    <AntHeader
      className={`relative flex items-center justify-between px-4 gap-4 ${
        mode === "dark" ? "bg-gray-800" : "bg-white"
      } border-b border-gray-200 shadow-sm`}
      style={{
        padding: "0 16px",
        background: mode === "dark" ? "#1f2937" : "#ffffff",
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Center: Search */}
      <div className="flex-1 max-w-xl mx-4">
        <AutoComplete
          value={searchValue}
          options={searchResults}
          onSearch={handleSearchRoom}
          onSelect={handleSelectRoom}
          allowClear
          style={{ width: "100%" }}
          notFoundContent={searchLoading ? <Spin size="small" /> : null}
        >
          <Input.Search
            placeholder="Search rooms by name or building..."
            enterButton
            loading={searchLoading}
            onSearch={handleSearchRoom}
            className="rounded-lg"
            style={{ background: mode === "dark" ? "#374151" : "#f3f4f6" }}
          />
        </AutoComplete>
      </div>

      {/* Right: Notifications + User avatar/login button */}
      <div className="flex items-center gap-1 flex-shrink-0">
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
        <div className="absolute right-4 top-16 w-[340px] md:w-[380px] bg-white rounded-2xl shadow-xl border border-gray-200 z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="font-semibold text-gray-900">Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-orange-500 hover:text-orange-600 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto px-3 py-2 bg-gray-50">
            {latestNotifications.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-5">
                You have no notifications yet.
              </div>
            ) : (
              latestNotifications.map((n, index) => (
                <div
                  key={n.id}
                  className={
                    index === 0 && n.category === "batch"
                      ? "mb-2.5 last:mb-0 rounded-2xl bg-orange-50 border border-orange-100 shadow-sm px-4 py-3"
                      : "flex items-start gap-3 mb-2.5 last:mb-0 rounded-xl bg-white px-3 py-2.5 shadow-sm border border-gray-100"
                  }
                >
                  {index === 0 && n.category === "batch" ? (
                    <>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="mt-1 w-8 h-8 rounded-full flex items-center justify-center text-xs bg-orange-100 text-orange-500">
                          ↻
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {n.message}
                          </p>
                        </div>
                      </div>
                      {typeof n.progress === "number" && (
                        <div className="mt-1">
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-400"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, n.progress),
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                            <span>{`${Math.min(
                              100,
                              Math.max(0, n.progress),
                            ).toFixed(0)}% Complete`}</span>
                            {n.statusText && (
                              <span className="text-orange-500 font-medium">
                                {n.statusText}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                          n.category === "ai"
                            ? "bg-blue-100 text-blue-500"
                            : n.category === "booking"
                              ? "bg-green-100 text-green-500"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {n.category === "ai" && <span>🤖</span>}
                        {n.category === "booking" && <span>✓</span>}
                        {!n.category && <span>•</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-600 mb-0.5">
                          {n.message}
                        </p>
                        <span className="text-[11px] text-gray-400">
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsNotificationOpen(false);
              navigate(ROUTES.NOTIFICATIONS);
            }}
            className="px-4 py-2.5 text-center text-sm font-semibold text-orange-500 border-t border-gray-100 hover:bg-orange-50"
          >
            See All Notifications
          </button>
        </div>
      )}
    </AntHeader>
  );
};

export default Header;
