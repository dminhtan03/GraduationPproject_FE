// ===== HEADER COMPONENT (UniBooking) =====

import React from "react";
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
import { logout } from "../../services/authService";

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const APP_NAME = "UniBooking";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useAppSelector(selectTheme);

  const userJson = localStorage.getItem(STORAGE_KEYS.USER_DATA);
  const user = userJson
    ? (JSON.parse(userJson) as { name?: string; email?: string })
    : null;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((s) => s[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "JD";

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
        {user ? (
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
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
              title="My Profile"
            >
              <Avatar
                size="default"
                style={{ backgroundColor: "#ff9500" }}
                className="flex items-center justify-center"
              >
                {initials}
              </Avatar>
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
