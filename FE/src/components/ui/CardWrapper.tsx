// ===== CARD WRAPPER COMPONENT =====

import React from "react";
import { Card, CardProps, Typography } from "antd";

const { Text } = Typography;

interface CardWrapperProps extends CardProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  contentPadding?: boolean;
}

// Card wrapper với thêm tính năng
export const CardWrapper: React.FC<CardWrapperProps> = ({
  children,
  title,
  icon,
  subtitle,
  headerExtra,
  contentPadding = true,
  className = "",
  ...rest
}) => {
  // Custom title with icon
  const customTitle = (
    <div className="flex items-center space-x-2">
      {icon && <span>{icon}</span>}
      <div>
        <div>{title}</div>
        {subtitle && (
          <Text className="text-sm text-gray-500 font-normal">{subtitle}</Text>
        )}
      </div>
    </div>
  );

  return (
    <Card
      title={icon || subtitle ? customTitle : title}
      extra={headerExtra}
      className={`shadow-sm hover:shadow-md transition-shadow ${className}`}
      bodyStyle={{
        padding: contentPadding ? "24px" : "0",
      }}
      {...rest}
    >
      {children}
    </Card>
  );
};

export default CardWrapper;
