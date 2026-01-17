// ===== SIDEBAR COMPONENT =====

import React from "react";
import { Layout, Menu, Typography } from "antd";
import {
  HomeOutlined,
  InfoCircleOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppSelector, selectLayout, selectTheme } from "../../store";
import { routeDefinitions } from "../../router/AppRouter";

const { Sider } = Layout;
const { Text } = Typography;

// Icon mapping
const iconMap = {
  home: <HomeOutlined />,
  info: <InfoCircleOutlined />,
  dashboard: <DashboardOutlined />,
};

// Sidebar component
const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed } = useAppSelector(selectLayout);
  const { mode } = useAppSelector(selectTheme);

  // Menu items từ route definitions
  const menuItems = routeDefinitions.map((route) => ({
    key: route.path,
    icon: iconMap[route.icon as keyof typeof iconMap],
    label: route.label,
  }));

  // Handle menu click
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // Get current selected key
  const selectedKey = location.pathname;

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
      {/* Logo section */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200">
        {!sidebarCollapsed ? (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Text className="text-white font-bold text-sm">R</Text>
            </div>
            <Text strong className="text-lg">
              React Base
            </Text>
          </div>
        ) : (
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Text className="text-white font-bold text-sm">R</Text>
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
        className="border-r-0"
        style={{
          background: mode === "dark" ? "#1f2937" : "#ffffff",
          marginTop: "8px",
        }}
      />

      {/* Footer info when not collapsed */}
      {!sidebarCollapsed && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <Text className="text-xs text-gray-600">React Base v1.0.0</Text>
            <br />
            <Text className="text-xs text-gray-500">Fresher Training</Text>
          </div>
        </div>
      )}
    </Sider>
  );
};

export default Sidebar;
