import React, { useState } from "react";
import { Modal, message } from "antd";
import { changePassword } from "../../services/authService";
import { ApiError } from "../../types";
import {
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const resolvedEmail = React.useMemo(() => {
    return email;
  }, [email]);

  const validate = () => {
    const nextErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword.trim()) {
      nextErrors.currentPassword = "Enter the temporary password you just used";
    }

    if (!newPassword.trim()) {
      nextErrors.newPassword = "Enter a new password";
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = "Use at least 8 characters";
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = "Confirm your new password";
    } else if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      message.success(
        result.data.message || "Password updated. Please keep it safe.",
      );
      resetForm();
      onChanged();
    } catch (error) {
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
      title={null}
      footer={null}
      closable={false}
      maskClosable={false}
      width={680}
      className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:p-0"
    >
      <div className="overflow-hidden rounded-3xl">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Update your password</h3>
              <p className="mt-1 text-sm text-orange-50">
                Secure your account before continuing.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-7">
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Hi{" "}
            <span className="font-semibold text-slate-800">
              {resolvedEmail || "there"}
            </span>
            , please replace the temporary password with one you can remember.
          </p>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Temporary password
              </label>
              <div className="relative">
                <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    if (errors.currentPassword) {
                      setErrors((prev) => ({
                        ...prev,
                        currentPassword: undefined,
                      }));
                    }
                  }}
                  placeholder="Temporary password"
                  autoComplete="current-password"
                  disabled={loading}
                  className={`w-full rounded-xl border bg-white px-11 py-3 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    errors.currentPassword
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                      : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-orange-500"
                  aria-label={
                    showCurrentPassword
                      ? "Hide temporary password"
                      : "Show temporary password"
                  }
                >
                  {showCurrentPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="mt-2 text-xs font-medium text-rose-500">
                  {errors.currentPassword}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                New password
              </label>
              <div className="relative">
                <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    if (errors.newPassword) {
                      setErrors((prev) => ({
                        ...prev,
                        newPassword: undefined,
                      }));
                    }
                  }}
                  placeholder="New password"
                  autoComplete="new-password"
                  disabled={loading}
                  className={`w-full rounded-xl border bg-white px-11 py-3 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    errors.newPassword
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                      : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-orange-500"
                  aria-label={
                    showNewPassword ? "Hide new password" : "Show new password"
                  }
                >
                  {showNewPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-2 text-xs font-medium text-rose-500">
                  {errors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Confirm new password
              </label>
              <div className="relative">
                <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({
                        ...prev,
                        confirmPassword: undefined,
                      }));
                    }
                  }}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  disabled={loading}
                  className={`w-full rounded-xl border bg-white px-11 py-3 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    errors.confirmPassword
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                      : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-orange-500"
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-xs font-medium text-rose-500">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <CheckCircleIcon className="h-4 w-4" />
              Password tip
            </p>
            <p className="mt-1">
              Use at least 8 characters with a mix of letters and numbers.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(249,115,22,0.9)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Saving..." : "Save password"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ChangePasswordModal;
