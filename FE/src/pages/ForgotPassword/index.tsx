import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomMessage, {
  MessageType,
} from "../../components/common/CustomMessage";
import { ROUTES, STORAGE_KEYS } from "../../constants";
import {
  requestPasswordReset,
  resendResetOtp,
  verifyResetOtp,
} from "../../services/authService";
import { ApiError } from "../../types";

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  const triggerPopup = (type: MessageType, message: string) => {
    setPopup({ type, message });
    setTimeout(() => setPopup(null), 3000);
  };

  useEffect(() => {
    if (step !== 2 || otpCountdown <= 0) return;

    const timer = window.setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step, otpCountdown]);

  const handleRequestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      triggerPopup("warning", "Please provide your email");
      return;
    }

    setLoading(true);
    try {
      const response = await requestPasswordReset({ email });
      triggerPopup("success", response.data.message || "OTP sent");
      setOtp("");
      setOtpCountdown(60);
      setStep(2);
    } catch (error) {
      triggerPopup(
        "error",
        (error as ApiError).message || "Unable to send OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (otpCountdown === 0) {
      triggerPopup("warning", "OTP expired. Please resend OTP to continue.");
      return;
    }

    if (!otp) {
      triggerPopup("warning", "Please enter the OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyResetOtp({ email, otp });
      triggerPopup("success", response.data.message);
      localStorage.setItem(
        STORAGE_KEYS.FORCED_PASSWORD_CHANGE,
        JSON.stringify({ email, enforcedAt: new Date().toISOString() }),
      );
      setStep(3);
    } catch (error) {
      triggerPopup(
        "error",
        (error as ApiError).message || "OTP verification failed. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      triggerPopup("warning", "Please enter your email again");
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const response = await resendResetOtp({ email });
      triggerPopup("success", response.data.message || "OTP resent");
      setOtp("");
      setOtpCountdown(60);
    } catch (error) {
      triggerPopup(
        "error",
        (error as ApiError).message || "Unable to resend OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateLogin = () => {
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <form className="space-y-6" onSubmit={handleRequestOtp}>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              University Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.edu"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            disabled={loading}
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      );
    }

    if (step === 2) {
      return (
        <form className="space-y-6" onSubmit={handleVerifyOtp}>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Enter OTP
            </label>
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={loading || otpCountdown === 0}
              required
            />
            <p className="mt-2 text-xs text-gray-500">
              We sent the code to {email}. Check your inbox and spam folder.
            </p>
            <p
              className={`mt-2 text-xs ${otpCountdown > 0 ? "text-indigo-600" : "text-red-500"}`}
            >
              {otpCountdown > 0
                ? `OTP expires in ${otpCountdown}s`
                : "OTP expired. Please resend OTP."}
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            disabled={loading || otpCountdown === 0}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          {otpCountdown === 0 && (
            <button
              type="button"
              onClick={handleResendOtp}
              className="w-full rounded-lg border border-indigo-600 px-4 py-2 text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
            >
              {loading ? "Resending..." : "Resend OTP"}
            </button>
          )}
        </form>
      );
    }

    return (
      <div className="space-y-6 text-center">
        <div className="rounded-lg bg-green-50 p-4 text-green-700">
          <h3 className="text-lg font-semibold">Temporary password sent</h3>
          <p className="mt-2 text-sm">
            We have generated a temporary password and emailed it to {email}.
            Use it to log in, then update your password when prompted.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNavigateLogin}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          Go to Login
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl">
              🔐
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Forgot Password
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Follow the steps to recover access to your account.
            </p>
          </div>

          <div className="mb-8 flex justify-between text-sm font-medium text-gray-500">
            <span className={step >= 1 ? "text-indigo-600" : ""}>1. Email</span>
            <span className={step >= 2 ? "text-indigo-600" : ""}>2. OTP</span>
            <span className={step === 3 ? "text-indigo-600" : ""}>3. Login</span>
          </div>

          {renderStepContent()}

          <div className="mt-8 text-center text-sm">
            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className="text-indigo-600 hover:text-indigo-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>

      {popup && (
        <CustomMessage
          type={popup.type}
          message={popup.message}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
};

export default ForgotPasswordPage;
