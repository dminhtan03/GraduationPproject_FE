// ===== CUSTOM BUTTON COMPONENT =====

import React from "react";
import { Button as AntButton, ButtonProps } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

interface CustomButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger";
  fullWidth?: boolean;
}

// Custom Button component với thêm variants
export const CustomButton: React.FC<CustomButtonProps> = ({
  variant = "primary",
  fullWidth = false,
  className = "",
  children,
  loading,
  ...rest
}) => {
  // Mapping variants to Ant Design types and classes
  const getButtonProps = () => {
    const baseClasses = fullWidth ? "w-full" : "";

    switch (variant) {
      case "primary":
        return {
          type: "primary" as const,
          className: `${baseClasses} ${className}`,
        };
      case "secondary":
        return {
          type: "default" as const,
          className: `${baseClasses} ${className}`,
        };
      case "success":
        return {
          type: "primary" as const,
          className: `${baseClasses} bg-green-500 hover:bg-green-600 border-green-500 hover:border-green-600 ${className}`,
        };
      case "warning":
        return {
          type: "primary" as const,
          className: `${baseClasses} bg-yellow-500 hover:bg-yellow-600 border-yellow-500 hover:border-yellow-600 ${className}`,
        };
      case "danger":
        return {
          danger: true,
          className: `${baseClasses} ${className}`,
        };
      default:
        return {
          type: "default" as const,
          className: `${baseClasses} ${className}`,
        };
    }
  };

  const buttonProps = getButtonProps();

  // Custom loading icon
  const loadingIcon = loading ? <LoadingOutlined spin /> : null;

  return (
    <AntButton
      {...buttonProps}
      {...rest}
      loading={loading}
      icon={loading ? loadingIcon : rest.icon}
    >
      {children}
    </AntButton>
  );
};

export default CustomButton;
