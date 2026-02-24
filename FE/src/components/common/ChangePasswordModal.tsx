import React, { useState } from "react";
import { Modal, Form, Input, message } from "antd";
import { changePassword } from "../../services/authService";
import { ApiError } from "../../types";

interface ChangePasswordModalProps {
  open: boolean;
  email?: string;
  onChanged: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  email,
  onChanged,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const resolvedEmail = React.useMemo(() => {
    return email;
  }, [email]);

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
        result.data.message || "Password updated. Please keep it safe.",
      );
      form.resetFields();
      onChanged();
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
    <Modal
      open={open}
      centered
      title="Update your password"
      okText={loading ? "Saving" : "Save password"}
      onOk={handleSubmit}
      okButtonProps={{ loading }}
      closable={false}
      cancelButtonProps={{ style: { display: "none" } }}
      maskClosable={false}
    >
      <p className="mb-4 text-sm text-gray-500">
        Hi {resolvedEmail || "there"}, for security reasons please replace the
        temporary password with one you can remember.
      </p>

      <Form form={form} layout="vertical">
        <Form.Item
          label="Temporary password"
          name="currentPassword"
          rules={[
            { required: true, message: "Enter the password you just used" },
          ]}
        >
          <Input.Password
            placeholder="Temporary password"
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
            placeholder="Confirm password"
            autoComplete="new-password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
