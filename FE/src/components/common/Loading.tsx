// ===== LOADING COMPONENT =====

import React from "react";
import { Spin, Typography } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface LoadingProps {
  size?: "small" | "default" | "large";
  message?: string;
  className?: string;
}

// Loading component với custom message
export const Loading: React.FC<LoadingProps> = ({
  size = "default",
  message = "Đang tải...",
  className = "",
}) => {
  const customIcon = (
    <LoadingOutlined style={{ fontSize: size === "large" ? 48 : 24 }} spin />
  );

  return (
    <div className={`text-center py-8 ${className}`}>
      <Spin indicator={customIcon} size={size} />
      {message && (
        <div className="mt-4">
          <Text className="text-gray-600">{message}</Text>
        </div>
      )}
    </div>
  );
};

// Page loading component
export const PageLoading: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loading size="large" message="Đang tải trang..." />
    </div>
  );
};

// Inline loading for small components
export const InlineLoading: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="flex items-center space-x-2 py-2">
      <Spin size="small" />
      {message && <Text className="text-sm text-gray-600">{message}</Text>}
    </div>
  );
};
