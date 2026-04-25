// ===== MAIN LAYOUT COMPONENT =====

import React, { useEffect, useState } from "react";
import { Layout, ConfigProvider, theme } from "antd";
import { Outlet } from "react-router-dom";
import { useAppSelector, selectTheme } from "../../store";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { AiChatWidget, ChangePasswordModal } from "../common";
import { STORAGE_KEYS } from "../../constants";

const { Content } = Layout;

// Main layout component
const MainLayout: React.FC = () => {
  const { mode, primaryColor } = useAppSelector(selectTheme);

  const [isChangePasswordVisible, setChangePasswordVisible] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.FORCED_PASSWORD_CHANGE);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { email?: string; enforcedAt?: string };
      setUserEmail(parsed?.email);
      setChangePasswordVisible(true);
    } catch {
      setChangePasswordVisible(true);
    }
  }, []);

  const handlePasswordChanged = () => {
    localStorage.removeItem(STORAGE_KEYS.FORCED_PASSWORD_CHANGE);
    setChangePasswordVisible(false);
  };

  // Ant Design theme config
  const antdTheme = {
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: primaryColor,
    },
  };

  return (
    <ConfigProvider theme={antdTheme}>
      <Layout className="min-h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <Layout>
          {/* Header */}
          <Header />

          {/* Page content */}
          <Content
            className={`
              min-h-[calc(100vh-128px)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6 
              ${mode === "dark" ? "bg-gray-900" : "bg-gray-50"}
            `}
            style={{
              background: mode === "dark" ? "#111827" : "#f9fafb",
              minHeight: "calc(100vh - 128px)", // Subtract header + footer height
            }}
          >
            {/* Wrapper để add consistent spacing */}
            <div className="max-w-7xl mx-auto">
              {/* Outlet sẽ render các page components */}
              <Outlet />
            </div>
          </Content>

          {/* Footer */}
          <Footer />
        </Layout>
      </Layout>

      {/* Floating AI chat widget visible on all main screens */}
      <AiChatWidget />

      <ChangePasswordModal
        open={isChangePasswordVisible}
        email={userEmail}
        onChanged={handlePasswordChanged}
      />
    </ConfigProvider>
  );
};

export default MainLayout;
