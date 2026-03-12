import React, { useState } from "react";
import { Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { changePassword } from "../../../services/authService";
import type { ApiError } from "../../../types";

const { Title, Paragraph } = Typography;

const ChangePasswordPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const result = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });

      message.success(
        result.data.message || "Your password has been updated successfully.",
      );
      form.resetFields();
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) {
        return;
      }

      if ((error as ApiError)?.message) {
        message.error((error as ApiError).message);
        return;
      }

      if (error instanceof Error && error.message) {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-2 py-4 sm:px-0 sm:py-8">
      <Card className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <SafetyCertificateOutlined className="text-xl" />
          </div>
          <div>
            <Title level={3} className="!mb-1">
              Change Password
            </Title>
            <Paragraph className="!mb-0 text-slate-500">
              Update your account password to keep your booking account secure.
            </Paragraph>
          </div>
        </div>

        <Form form={form} layout="vertical">
          <Form.Item
            label="Current password"
            name="currentPassword"
            rules={[{ required: true, message: "Enter your current password" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Current password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item
            label="New password"
            name="newPassword"
            rules={[
              { required: true, message: "Enter a new password" },
              { min: 8, message: "Use at least 8 characters" },
            ]}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="New password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={["newPassword"]}
            hasFeedback
            rules={[
              { required: true, message: "Confirm your new password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </Form.Item>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save password"}
            </button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
