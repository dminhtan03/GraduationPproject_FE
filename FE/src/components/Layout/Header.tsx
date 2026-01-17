// ===== HEADER COMPONENT =====

import React from "react";
import { Layout, Button, Typography, Space, Dropdown, Avatar } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import {
  useAppDispatch,
  useAppSelector,
  toggleSidebar,
  selectLayout,
  selectTheme,
} from "../../store";

const { Header: AntHeader } = Layout;
const { Text } = Typography;

// Props interface
interface HeaderProps {
  // Có thể thêm props khác nếu cần
}

// Header component
const Header: React.FC<HeaderProps> = () => {
  const dispatch = useAppDispatch();
  const { sidebarCollapsed } = useAppSelector(selectLayout);
  const { mode } = useAppSelector(selectTheme);

  // Menu cho user dropdown
  const userMenuItems: MenuProps["items"] = [
    {
      key: "1",
      label: "Thông tin cá nhân",
      icon: <UserOutlined />,
    },
    {
      key: "2",
      label: "Cài đặt",
      icon: <SettingOutlined />,
    },
    {
      type: "divider",
    },
    {
      key: "3",
      label: "Đăng xuất",
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];

  // Handle user menu click
  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case "1":
        console.log("Xem thông tin cá nhân");
        break;
      case "2":
        console.log("Mở cài đặt");
        break;
      case "3":
        console.log("Đăng xuất");
        break;
    }
  };

  // Handle toggle sidebar
  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  return (
    <AntHeader
      className={`
        flex items-center justify-between px-4 
        ${mode === "dark" ? "bg-gray-800" : "bg-white"} 
        border-b border-gray-200 shadow-sm
      `}
      style={{
        padding: "0 16px",
        background: mode === "dark" ? "#1f2937" : "#ffffff",
      }}
    >
      {/* Left side - Logo and menu toggle */}
      <div className="flex items-center space-x-4">
        <Button
          type="text"
          icon={
            sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
          }
          onClick={handleToggleSidebar}
          className="text-lg"
        />

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Text className="text-white font-bold text-sm">R</Text>
          </div>
          <Text strong className="text-lg">
            React Base
          </Text>
        </div>
      </div>

      {/* Right side - Notifications and user menu */}
      <Space size="large">
        {/* Notification bell */}
        <Button
          type="text"
          icon={<BellOutlined />}
          className="text-lg"
          onClick={() => console.log("Mở thông báo")}
        />

        {/* User dropdown */}
        <Dropdown
          menu={{
            items: userMenuItems,
            onClick: handleUserMenuClick,
          }}
          placement="bottomRight"
          arrow
        >
          <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 rounded-lg px-2 py-1">
            <Avatar
              size="small"
              icon={<UserOutlined />}
              className="bg-blue-500"
            />
            <Text className="hidden sm:inline">Fresher User</Text>
          </div>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;
