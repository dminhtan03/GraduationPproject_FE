// ===== FOOTER COMPONENT =====

import React from "react";
import { Layout, Typography, Space, Divider } from "antd";
import {
  GithubOutlined,
  TwitterOutlined,
  MailOutlined,
  CopyrightOutlined,
} from "@ant-design/icons";
import { useAppSelector, selectTheme } from "../../store";

const { Footer: AntFooter } = Layout;
const { Text, Link } = Typography;

// Footer component
const Footer: React.FC = () => {
  const { mode } = useAppSelector(selectTheme);
  const currentYear = new Date().getFullYear();

  return (
    <AntFooter
      className={`text-center ${
        mode === "dark" ? "bg-gray-800" : "bg-gray-50"
      } border-t`}
      style={{
        background: mode === "dark" ? "#1f2937" : "#f9fafb",
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8">
          {/* Brand section */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Text className="text-white font-bold text-sm">R</Text>
              </div>
              <Text strong className="text-lg">
                React Base
              </Text>
            </div>
            <Text className="text-gray-600">
              Base React application dành cho Fresher,
              <br />
              tích hợp đầy đủ các công nghệ hiện đại.
            </Text>
          </div>

          {/* Quick links */}
          <div className="text-center">
            <Text strong className="text-base mb-4 block">
              Liên kết nhanh
            </Text>
            <div className="space-y-2">
              <div>
                <Link href="/" className="text-gray-600 hover:text-blue-500">
                  Trang chủ
                </Link>
              </div>
              <div>
                <Link
                  href="/about"
                  className="text-gray-600 hover:text-blue-500"
                >
                  Giới thiệu
                </Link>
              </div>
              <div>
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-blue-500"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>

          {/* Contact & Social */}
          <div className="text-center md:text-right">
            <Text strong className="text-base mb-4 block">
              Liên hệ
            </Text>
            <Space direction="vertical" size="small">
              <div>
                <MailOutlined className="mr-2" />
                <Link
                  href="mailto:contact@reactbase.com"
                  className="text-gray-600 hover:text-blue-500"
                >
                  contact@reactbase.com
                </Link>
              </div>
              <div className="flex justify-center md:justify-end space-x-4 mt-4">
                <Link
                  href="https://github.com"
                  target="_blank"
                  className="text-gray-600 hover:text-blue-500 text-lg"
                >
                  <GithubOutlined />
                </Link>
                <Link
                  href="https://twitter.com"
                  target="_blank"
                  className="text-gray-600 hover:text-blue-500 text-lg"
                >
                  <TwitterOutlined />
                </Link>
              </div>
            </Space>
          </div>
        </div>

        <Divider className="my-4" />

        {/* Copyright */}
        <div className="py-4">
          <Text className="text-gray-500 text-sm">
            <CopyrightOutlined className="mr-1" />
            {currentYear} React Base. Được phát triển bởi Fresher Team. Sử dụng
            React, TypeScript, Ant Design và TailwindCSS.
          </Text>
        </div>

        {/* Tech stack info */}
        <div className="py-2">
          <Space
            split={<Divider type="vertical" />}
            className="text-xs text-gray-400"
          >
            <span>React 18</span>
            <span>TypeScript</span>
            <span>Vite</span>
            <span>Ant Design</span>
            <span>TailwindCSS</span>
            <span>Redux Toolkit</span>
            <span>React Router</span>
            <span>Axios</span>
            <span>WebSocket</span>
          </Space>
        </div>
      </div>
    </AntFooter>
  );
};

export default Footer;
