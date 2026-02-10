// Profile screen logic: fetch and display user profile

import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Tag,
  Avatar,
  Alert,
  Empty,
} from "antd";
import {
  EditOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { fetchMockProfile } from "../../utils/mockData";
import type { UserProfile, RecentActivity } from "../../types";

const { Title, Text } = Typography;

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMockProfile(false);
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load profile data");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleEditProfile = () => {
    navigate(ROUTES.PROFILE_EDIT);
  };

  const handleViewAllActivity = () => {
    navigate(ROUTES.MY_BOOKINGS);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Unable to load profile data"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={loadProfile}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!profile) return null;

  const initials = profile.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="fade-in">
      {/* Profile summary card */}
      <Card className="mb-6 rounded-xl bg-gray-50 border-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            size={80}
            src={profile.avatar}
            style={{ backgroundColor: "#ff9500" }}
            className="flex items-center justify-center text-2xl"
          >
            {initials}
          </Avatar>
          <div className="flex-1 min-w-0">
            <Title level={3} className="mb-1">
              {profile.name}
            </Title>
            <Text strong style={{ color: "#ff9500" }} className="block">
              {profile.role}
            </Text>
            <Text className="text-gray-600"> • {profile.department}</Text>
            <div className="mt-1">
              <Text className="text-gray-500 text-sm">
                Member since {profile.memberSince}
              </Text>
            </div>
          </div>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEditProfile}
            className="rounded-lg"
            style={{ background: "#ff9500", borderColor: "#ff9500" }}
          >
            Edit Profile
          </Button>
        </div>
      </Card>

      {/* Booking statistics */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={8}>
          <Card className="rounded-xl h-full">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "#fff3e0" }}
              >
                <FileTextOutlined style={{ color: "#ff9500", fontSize: 20 }} />
              </div>
              <div>
                <Text className="text-gray-500 text-sm">Total Bookings</Text>
                <div className="text-xl font-bold">
                  {profile.stats.totalBookings}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="rounded-xl h-full">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "#fff3e0" }}
              >
                <ClockCircleOutlined
                  style={{ color: "#ff9500", fontSize: 20 }}
                />
              </div>
              <div>
                <Text className="text-gray-500 text-sm">Hours Spent</Text>
                <div className="text-xl font-bold">
                  {profile.stats.hoursSpent}h
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="rounded-xl h-full">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "#fff3e0" }}
              >
                <HeartOutlined style={{ color: "#ff9500", fontSize: 20 }} />
              </div>
              <div>
                <Text className="text-gray-500 text-sm">Top Facility</Text>
                <div className="text-base font-semibold truncate">
                  {profile.stats.topFacility}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Personal information */}
      <Card
        className="mb-6 rounded-xl"
        title={
          <span>
            <RiseOutlined className="mr-2" />
            Personal Information
          </span>
        }
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <div className="mb-2">
              <Text className="text-gray-500 text-xs uppercase">
                Email Address
              </Text>
              <div className="font-medium">{profile.personalInfo.email}</div>
            </div>
            <div className="mb-2">
              <Text className="text-gray-500 text-xs uppercase">
                Student ID
              </Text>
              <div className="font-medium">
                {profile.personalInfo.studentId}
              </div>
            </div>
            <div>
              <Text className="text-gray-500 text-xs uppercase">
                Academic Year
              </Text>
              <div className="font-medium">
                {profile.personalInfo.academicYear}
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="mb-2">
              <Text className="text-gray-500 text-xs uppercase">
                Phone Number
              </Text>
              <div className="font-medium">
                {profile.personalInfo.phoneNumber}
              </div>
            </div>
            <div className="mb-2">
              <Text className="text-gray-500 text-xs uppercase">
                Department
              </Text>
              <div className="font-medium">
                {profile.personalInfo.department}
              </div>
            </div>
            <div>
              <Text className="text-gray-500 text-xs uppercase">
                Emergency Contact
              </Text>
              <div className="font-medium">
                {profile.personalInfo.emergencyContact}
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Recent activity */}
      <Card
        className="rounded-xl"
        title="Recent Activity"
        extra={
          <Button type="link" onClick={handleViewAllActivity} className="p-0">
            View All
          </Button>
        }
      >
        {profile.recentActivities.length === 0 ? (
          <Empty
            description="No recent activities"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div className="space-y-4">
            {profile.recentActivities.map((activity: RecentActivity) => (
              <div
                key={activity.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100"
                    style={{ color: "#ff9500" }}
                  >
                    <RiseOutlined />
                  </div>
                  <div>
                    <Text strong className="block">
                      {activity.facilityName}
                    </Text>
                    <Text className="text-gray-500 text-sm">
                      {activity.dateTime}
                    </Text>
                  </div>
                </div>
                <Tag
                  color={
                    activity.status === "Confirmed"
                      ? "green"
                      : activity.status === "Completed"
                        ? "orange"
                        : "default"
                  }
                >
                  {activity.status}
                </Tag>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProfilePage;
