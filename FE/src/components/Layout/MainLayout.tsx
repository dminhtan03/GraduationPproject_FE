// ===== MAIN LAYOUT COMPONENT =====

import React from "react";
import { Layout, ConfigProvider, theme } from "antd";
import { Outlet } from "react-router-dom";
import { useAppSelector, selectTheme } from "../../store";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

const { Content } = Layout;

// Main layout component
const MainLayout: React.FC = () => {
  const { mode, primaryColor } = useAppSelector(selectTheme);

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
              min-h-[calc(100vh-128px)] p-6 
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
    </ConfigProvider>
  );
};

export default MainLayout;
