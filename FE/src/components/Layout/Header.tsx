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
import { STORAGE_KEYS, ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import type { UserProfile } from "../../types";
import { logout } from "../../services/authService";
import { roomService } from "../../services/roomService";

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const APP_NAME = "UniBooking";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useAppSelector(selectTheme);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Search state
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
        const userData = res.data?.data || res.data;
        setProfile(userData || null);
      } catch {
        setProfile(null);
      } finally {
        setLoadingProfile(false);
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

  const handleSelectRoom = (value: string, option: any) => {
    // Có thể chuyển hướng sang trang chi tiết phòng hoặc highlight phòng
    // Ví dụ: navigate(`/rooms/${option.room.id}`);
    // Hiện tại chỉ clear search
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
    if ((profile as any).avatar) avatarUrl = (profile as any).avatar;
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

  return (
    <AntHeader
      className={`flex items-center justify-between px-4 gap-4 ${
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
          <span className="text-white text-lg" aria-hidden>
            📚
          </span>
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
        <Button
          type="text"
          icon={<BellOutlined className="text-lg" />}
          onClick={() => {}}
        />
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
    </AntHeader>
  );
};

export default Header;
