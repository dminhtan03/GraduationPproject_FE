import React, { useCallback, useEffect, useState } from "react";
import { Typography, Card, Row, Col, Button, Avatar, Alert } from "antd";
import { EditOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import type { UserProfile } from "../../types";

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
      const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
      const userData = res.data?.data || res.data;
      if (userData) {
        setProfile(userData);
      } else {
        setError("Unable to load profile data");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load profile data");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="h-12 w-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <Alert
          message="Unable to load profile"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (!profile) return null;

  const initials =
    `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <Title level={2} className="!mb-1 text-orange-500 font-semibold">
          My Profile
        </Title>
        <Text className="text-gray-500">
          Manage and view your personal information
        </Text>
      </div>

      {/* Profile Summary Card */}
      <Card className="rounded-2xl shadow-md border-0 mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <Avatar
            size={100}
            style={{ backgroundColor: "#ff7a00" }}
            className="text-3xl font-semibold"
            icon={!initials && <UserOutlined />}
          >
            {initials}
          </Avatar>

          <div className="flex-1 text-center md:text-left">
            <Title level={3} className="!mb-1">
              {profile.firstName} {profile.lastName}
            </Title>
            <Text className="text-gray-500 block mb-2">
              {profile.department}
            </Text>
            <Text className="text-gray-600 text-sm">{profile.email}</Text>
          </div>

          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEditProfile}
            className="rounded-xl px-6 h-10"
            style={{ background: "#ff7a00", borderColor: "#ff7a00" }}
          >
            Edit Profile
          </Button>
        </div>
      </Card>

      {/* Detail Card */}
      <Card className="rounded-2xl shadow-md border-0">
        <Title level={4} className="mb-6 text-gray-700">
          Personal Information
        </Title>

        <Row gutter={[32, 24]}>
          <Col xs={24} md={12}>
            <InfoItem label="First Name" value={profile.firstName} />
            <InfoItem label="Last Name" value={profile.lastName} />
            <InfoItem label="Email" value={profile.email} />
            <InfoItem label="Gender" value={profile.gender} />
          </Col>

          <Col xs={24} md={12}>
            <InfoItem label="Phone Number" value={profile.phoneNumber} />
            <InfoItem label="Address" value={profile.address} />
            <InfoItem label="Department" value={profile.department} />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string; value?: string }) => (
  <div className="mb-5">
    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase mb-1">
      {label}
    </div>
    <div className="text-base font-medium text-gray-800 bg-gray-50 rounded-lg px-4 py-2">
      {value || "-"}
    </div>
  </div>
);

export default ProfilePage;
