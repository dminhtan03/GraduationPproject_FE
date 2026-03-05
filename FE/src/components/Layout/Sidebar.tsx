// ===== SIDEBAR COMPONENT (UniBooking) =====

import React from "react";
import { Layout, Menu, Typography } from "antd";
import {
  AppstoreOutlined,
  BankOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppSelector, selectLayout, selectTheme } from "../../store";
import { ROUTES } from "../../constants";

const { Sider } = Layout;
const { Text } = Typography;

const APP_NAME = "UniBooking";

// Sidebar component
const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed } = useAppSelector(selectLayout);
  const { mode } = useAppSelector(selectTheme);

  const menuItems: {
    key: string;
    icon: React.ReactNode;
    label: React.ReactNode;
    children?: { key: string; icon: React.ReactNode; label: React.ReactNode }[];
  }[] = [
    { key: ROUTES.ROOM_LIST, icon: <BankOutlined />, label: "Room List" },
    {
      key: ROUTES.AI_ASSISTANT,
      icon: <AppstoreOutlined />,
      label: "AI Assistant",
    },
    {
      key: ROUTES.MY_BOOKINGS,
      icon: <CalendarOutlined />,
      label: "My Bookings",
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const path = location.pathname;
  const selectedKey = path;

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={sidebarCollapsed}
      theme={mode}
      className="min-h-screen"
      style={{
        background: mode === "dark" ? "#1f2937" : "#ffffff",
        borderRight: "1px solid #e5e7eb",
      }}
    >
      {/* Logo section - UniBooking */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200 px-2">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#ff9500" }}
            >
              <BookOpenIcon className="w-5 h-5 text-white" aria-hidden />
            </div>
            <Text strong className="text-lg truncate">
              {APP_NAME}
            </Text>
          </div>
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#ff9500" }}
          >
            <span className="text-white text-lg" aria-hidden>
              📚
            </span>
          </div>
        )}
      </div>

      {/* Navigation menu */}
      <Menu
        theme={mode}
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={handleMenuClick}
        className="border-r-0 mt-2"
        style={{
          background: mode === "dark" ? "#1f2937" : "#ffffff",
        }}
      />
    </Sider>
  );
};

export default Sidebar;
