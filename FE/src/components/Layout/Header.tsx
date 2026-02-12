// ===== HEADER COMPONENT (UniBooking) =====

import React, { useEffect, useState } from "react";
import { Layout, Button, Typography, Input, Avatar, Dropdown } from "antd";
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

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const APP_NAME = "UniBooking";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useAppSelector(selectTheme);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

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
        <Input
          placeholder="Search rooms..."
          allowClear
          className="rounded-lg"
          style={{ background: mode === "dark" ? "#374151" : "#f3f4f6" }}
        />
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
