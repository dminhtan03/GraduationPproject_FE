import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Avatar,
  Alert,
  Form,
  Input,
  message,
} from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import type { UserProfile } from "../../types";

const { Title, Text } = Typography;

const phoneRegex = /^0\d{0,9}$/;

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
      const userData = res.data?.data || res.data;
      if (userData) {
        setProfile(userData);
        form.setFieldsValue({
          phoneNumber: userData.phoneNumber || "",
          address: userData.address || "",
        });
      } else {
        setError("Unable to load profile data");
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.meta?.message ||
        (e instanceof Error ? e.message : "Unable to load profile data");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleCancel = () => {
    navigate(ROUTES.PROFILE);
  };

  const handleSubmit = async (values: {
    phoneNumber: string;
    address: string;
  }) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.put(API_ENDPOINTS.USERS.UPDATE_INFO, {
        phoneNumber: values.phoneNumber.trim(),
        address: values.address.trim(),
      });
      message.success("Profile updated successfully");
      navigate(ROUTES.PROFILE);
    } catch (e: any) {
      const msg =
        e?.response?.data?.meta?.message ||
        (e instanceof Error ? e.message : "Failed to update profile");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="h-12 w-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
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
      <div className="mb-8">
        <Title level={2} className="!mb-1 text-orange-500 font-semibold">
          Edit Profile
        </Title>
        <Text className="text-gray-500">
          Update your contact information. Other details are read-only.
        </Text>
      </div>

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
        </div>
      </Card>

      <Card className="rounded-2xl shadow-md border-0">
        <div className="flex items-center justify-between mb-6">
          <Title level={4} className="mb-0 text-gray-700">
            Personal Information
          </Title>
        </div>

        {error && (
          <div className="mb-4">
            <Alert
              message="Update failed"
              description={error}
              type="error"
              showIcon
            />
          </div>
        )}

        <Form
          layout="vertical"
          form={form}
          onFinish={handleSubmit}
          initialValues={{
            phoneNumber: profile.phoneNumber || "",
            address: profile.address || "",
          }}
        >
          <Row gutter={[32, 24]}>
            <Col xs={24} md={12}>
              <ReadOnlyItem label="First Name" value={profile.firstName} />
              <ReadOnlyItem label="Last Name" value={profile.lastName} />
              <ReadOnlyItem label="Email" value={profile.email} />
              <ReadOnlyItem label="Gender" value={profile.gender} />
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label={
                  <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    Phone Number
                  </span>
                }
                name="phoneNumber"
                rules={[
                  { required: true, message: "Phone number is required" },
                  {
                    pattern: phoneRegex,
                    message:
                      "Phone must start with 0 and contain up to 10 digits",
                  },
                ]}
              >
                <Input
                  maxLength={10}
                  placeholder="Enter phone number"
                  className="bg-white rounded-lg"
                />
              </Form.Item>

              <Form.Item
                label={
                  <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    Address
                  </span>
                }
                name="address"
                rules={[{ required: true, message: "Address is required" }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Enter address"
                  className="bg-white rounded-lg"
                />
              </Form.Item>

              <ReadOnlyItem label="Department" value={profile.department} />
            </Col>
          </Row>

          <div className="mt-6 flex justify-end gap-3">
            <Button onClick={handleCancel} className="rounded-xl px-6 h-10">
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              className="rounded-xl px-6 h-10"
              style={{ background: "#ff7a00", borderColor: "#ff7a00" }}
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

const ReadOnlyItem = ({ label, value }: { label: string; value?: string }) => (
  <div className="mb-5">
    <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase mb-1">
      {label}
    </div>
    <div className="text-base font-medium text-gray-800 bg-gray-50 rounded-lg px-4 py-2">
      {value || "-"}
    </div>
  </div>
);

export default EditProfilePage;
