import React from "react";
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
}) => {
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
