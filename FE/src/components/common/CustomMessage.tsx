import React, { useEffect } from "react";
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import "../../styles/CustomMessage.css";

export type MessageType = "success" | "error" | "warning" | "info";

interface CustomMessageProps {
  type?: MessageType;
  message: string;
  onClose?: () => void;
  duration?: number; // duration in milliseconds, 0 to disable auto-close
}

const iconMap = {
  success: <CheckCircleOutlined />,
  error: <CloseCircleOutlined />,
  warning: <WarningOutlined />,
  info: <InfoCircleOutlined />,
};

const CustomMessage: React.FC<CustomMessageProps> = ({
  type = "info",
  message,
  onClose,
  duration = 3000, // default 3 seconds
}) => {
  useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={`custom-message ${type}`}>
      <span className="custom-message-icon">{iconMap[type]}</span>
      <span className="custom-message-text">{message}</span>
      {onClose && (
        <button
          type="button"
          aria-label="Close message"
          className="custom-message-close"
          onClick={onClose}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default CustomMessage;
