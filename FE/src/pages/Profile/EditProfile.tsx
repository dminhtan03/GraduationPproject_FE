// ===== EDIT PROFILE PAGE =====
// Only authenticated users; users can only edit their own profile.
// TODO: Replace mock save with api.put(API_ENDPOINTS.USER.PROFILE, payload) when BE ready

import React, { useEffect, useState } from "react";
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  Avatar,
  message,
  Breadcrumb,
  Space,
} from "antd";
import {
  LockOutlined,
  DeleteOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { STORAGE_KEYS } from "../../constants";
import { getMockEditProfileInitial } from "../../utils/mockData";

const { Title, Text } = Typography;
const { TextArea } = Input;

// Format: +1 (555) 000-0000 — allow flexible spaces
const PHONE_REGEX = /^\+1\s*\(\s*\d{3}\s*\)\s*\d{3}\s*-\s*\d{4}$/;

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    if (!token) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }
    const initial = getMockEditProfileInitial();
    form.setFieldsValue({
      firstName: initial.firstName,
      lastName: initial.lastName,
      phoneNumber: initial.phoneNumber,
      campusAddress: initial.campusAddress.replace(/\\n/g, "\n"),
    });
    setAvatarUrl(initial.avatar);
  }, [form, navigate]);

  const handleCancel = () => {
    form.resetFields();
    navigate(ROUTES.PROFILE);
  };

  const handleSave = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }

    const values = form.getFieldsValue();
    const phone = values.phoneNumber?.trim().replace(/\s+/g, " ");
    if (phone && !PHONE_REGEX.test(phone)) {
      form.setFields([
        { name: "phoneNumber", errors: ["Format: +1 (555) 000-0000"] },
      ]);
      return;
    }

    setSaving(true);
    try {
      // TODO: await api.put(API_ENDPOINTS.USER.PROFILE, { firstName, lastName, phoneNumber, campusAddress, avatar: avatarUrl })
      await new Promise((r) => setTimeout(r, 600));
      message.success("Profile updated successfully");
      navigate(ROUTES.PROFILE);
    } catch {
      message.error("Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initial = getMockEditProfileInitial();
  const initials =
    `${initial.firstName[0]}${initial.lastName[0]}`.toUpperCase();

  const handleChangePhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setAvatarUrl(url);
        message.success("Photo updated. Click Save Changes to confirm.");
      }
    };
    input.click();
  };

  return (
    <div className="fade-in">
      <Breadcrumb
        className="mb-2"
        items={[{ title: "Settings" }, { title: "Edit Profile" }]}
      />
      <Title level={2} className="mb-6">
        Edit Profile
      </Title>

      {/* Profile header card */}
      <Card className="mb-6 rounded-xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar
              size={80}
              src={avatarUrl}
              style={{ backgroundColor: "#ff9500" }}
              className="flex items-center justify-center text-2xl"
            >
              {initials}
            </Avatar>
            <div
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
              style={{ background: "#ff9500" }}
            >
              <LockOutlined />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Title level={4} className="mb-0">
              {initial.firstName} {initial.lastName}
            </Title>
            <Text className="text-gray-600">
              {initial.role} • ID: {initial.studentId}
            </Text>
          </div>
          <Button onClick={handleChangePhoto} className="rounded-lg">
            Change Photo
          </Button>
        </div>
      </Card>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Card title="Basic Information" className="mb-6 rounded-xl">
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: "First name is required" }]}
          >
            <Input placeholder="First Name" className="rounded-lg" />
          </Form.Item>
          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: "Last name is required" }]}
          >
            <Input placeholder="Last Name" className="rounded-lg" />
          </Form.Item>
        </Card>

        <Card title="Contact Details" className="mb-6 rounded-xl">
          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            help="Format: +1 (555) 000-0000"
            rules={[
              { required: true, message: "Phone number is required" },
              {
                pattern: PHONE_REGEX,
                message: "Format: +1 (555) 000-0000",
              },
            ]}
          >
            <Input
              prefix={<PhoneOutlined className="text-gray-400" />}
              placeholder="+1 (555) 123-4567"
              className="rounded-lg"
            />
          </Form.Item>
          <Form.Item
            name="campusAddress"
            label="Campus Address"
            rules={[{ required: true, message: "Campus address is required" }]}
          >
            <TextArea
              rows={3}
              placeholder="Building, Room&#10;Street, Campus"
              className="rounded-lg"
            />
          </Form.Item>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Space className="text-gray-500 text-sm">
            <Button type="link" className="p-0" icon={<LockOutlined />}>
              Change Password
            </Button>
          </Space>
          <Space>
            <Button onClick={handleCancel} className="rounded-lg">
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              className="rounded-lg"
              style={{ background: "#ff9500", borderColor: "#ff9500" }}
            >
              Save Changes
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default EditProfilePage;
