import React, { useState } from "react";
import { Form, Input, message } from "antd";
import { LockOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { changePassword } from "../../../services/authService";
import type { ApiError } from "../../../types";

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
    <div className="relative mx-auto max-w-3xl px-2 py-4 sm:px-0 sm:py-8">
      <div className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-52 w-52 rounded-full bg-amber-200/30 blur-3xl" />

      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_42px_-28px_rgba(15,23,42,0.35)]">
        <div className="border-b border-slate-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm">
              <SafetyCertificateOutlined className="text-2xl" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">
                Account Security
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
                Change Password
              </h1>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <Form form={form} layout="vertical" requiredMark={false}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Verify Current Password
                </div>
                <Form.Item
                  className="!mb-0"
                  label={
                    <span className="text-sm font-semibold text-slate-700">
                      Current password
                    </span>
                  }
                  name="currentPassword"
                  rules={[
                    { required: true, message: "Enter your current password" },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-slate-400" />}
                    placeholder="Current password"
                    autoComplete="current-password"
                    className="h-11 rounded-xl"
                  />
                </Form.Item>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Set New Password
                </div>
                <div className="space-y-4">
                  <Form.Item
                    className="!mb-0"
                    label={
                      <span className="text-sm font-semibold text-slate-700">
                        New password
                      </span>
                    }
                    name="newPassword"
                    rules={[
                      { required: true, message: "Enter a new password" },
                      { min: 8, message: "Use at least 8 characters" },
                    ]}
                    hasFeedback
                  >
                    <Input.Password
                      prefix={<LockOutlined className="text-slate-400" />}
                      placeholder="New password"
                      autoComplete="new-password"
                      className="h-11 rounded-xl"
                    />
                  </Form.Item>

                  <Form.Item
                    className="!mb-0"
                    label={
                      <span className="text-sm font-semibold text-slate-700">
                        Confirm new password
                      </span>
                    }
                    name="confirmPassword"
                    dependencies={["newPassword"]}
                    hasFeedback
                    rules={[
                      {
                        required: true,
                        message: "Confirm your new password",
                      },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (
                            !value ||
                            getFieldValue("newPassword") === value
                          ) {
                            return Promise.resolve();
                          }
                          return Promise.reject(
                            new Error("Passwords do not match"),
                          );
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="text-slate-400" />}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      className="h-11 rounded-xl"
                    />
                  </Form.Item>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => form.resetFields()}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Saving..." : "Save password"}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
