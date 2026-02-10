// ===== MY BOOKINGS PAGE (Placeholder) =====

import React from "react";
import { Typography, Empty } from "antd";
import { CalendarOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const MyBookingsPage: React.FC = () => {
  return (
    <div className="fade-in">
      <Title level={2}>My Bookings</Title>
      <Paragraph className="text-gray-600 mb-6">
        View and manage your room reservations.
      </Paragraph>
      <Empty
        image={<CalendarOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />}
        description="No bookings yet. Book a room from the Dashboard."
      />
    </div>
  );
};

export default MyBookingsPage;
