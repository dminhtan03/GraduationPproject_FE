import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomMessage, {
  MessageType,
} from "../../components/common/CustomMessage";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  EnvelopeIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { ROUTES, STORAGE_KEYS } from "../../constants";
import {
  requestPasswordReset,
  resendResetOtp,
  verifyResetOtp,
} from "../../services/authService";
import { ApiError } from "../../types";
import campusBackground from "../../assets/image.png";

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
        (error as ApiError).message ||
          "Unable to resend OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateLogin = () => {
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const currentStepIndex = step - 1;
  const progressWidth = `${(step / 3) * 100}%`;

  const stepItems = [
    { title: "Email", hint: "Request OTP" },
    { title: "OTP", hint: "Verify code" },
    { title: "Done", hint: "Back to login" },
  ] as const;

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <form className="space-y-6" onSubmit={handleRequestOtp}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              University Email
            </label>
            <div className="relative">
              <EnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@fpt.edu.vn"
                className="block w-full rounded-xl border border-slate-200 bg-white px-11 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                disabled={loading}
                required
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              We will send a one-time code to your university email.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
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
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Enter OTP
            </label>
            <div className="relative">
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                className="block w-full rounded-xl border border-slate-200 bg-white px-11 py-3 text-sm tracking-[0.25em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                disabled={loading || otpCountdown === 0}
                required
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              We sent the code to {email}. Check your inbox and spam folder.
            </p>
            <p
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                otpCountdown > 0
                  ? "bg-orange-50 text-orange-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {otpCountdown > 0
                ? `OTP expires in ${otpCountdown}s`
                : "OTP expired. Please resend OTP."}
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={loading || otpCountdown === 0}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          {otpCountdown === 0 && (
            <button
              type="button"
              onClick={handleResendOtp}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-600 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
            >
              <ArrowPathIcon className="h-4 w-4" />
              {loading ? "Resending..." : "Resend OTP"}
            </button>
          )}
        </form>
      );
    }

    return (
      <div className="space-y-6 text-center">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-700">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckBadgeIcon className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold">Temporary password sent</h3>
          <p className="mt-2 text-sm">
            We have generated a temporary password and emailed it to {email}.
            Use it to log in, then update your password when prompted.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNavigateLogin}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105"
        >
          Go to Login
        </button>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f6fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-20 top-12 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_25px_80px_-30px_rgba(15,23,42,0.45)] backdrop-blur lg:grid-cols-[1.05fr_1fr]">
          <section
            className="relative hidden overflow-hidden bg-cover bg-center p-10 text-white lg:flex lg:flex-col"
            style={{ backgroundImage: `url(${campusBackground})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/45 to-slate-900/30" />

            <div className="relative z-10">
              <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold tracking-[0.18em] text-orange-200">
                ACCOUNT RECOVERY
              </p>
              <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight">
                Get Back In Securely
              </h1>
              <p className="mt-3 max-w-md text-slate-200">
                Verify your identity with OTP and receive a temporary password
                so you can access your account again.
              </p>
            </div>

            <div className="relative z-10 mt-auto space-y-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">
                  Fast OTP verification
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Enter the 6-digit code sent to your email in seconds.
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">
                  Safe password reset flow
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Use temporary credentials and update password immediately.
                </p>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <button
                type="button"
                onClick={() => navigate(ROUTES.LOGIN)}
                className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-orange-500"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Login
              </button>

              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                  Password Assistance
                </p>
                <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  Forgot Password
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Follow the steps below to recover access to your account.
                </p>
              </div>

              <div className="mb-8">
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all"
                    style={{ width: progressWidth }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {stepItems.map((item, index) => {
                    const isActive = index === currentStepIndex;
                    const isDone = index < currentStepIndex;
                    return (
                      <div
                        key={item.title}
                        className={`rounded-xl border px-2 py-2 text-center transition ${
                          isDone || isActive
                            ? "border-orange-200 bg-orange-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold ${
                            isDone || isActive
                              ? "text-orange-600"
                              : "text-slate-400"
                          }`}
                        >
                          {index + 1}. {item.title}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {item.hint}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {renderStepContent()}
            </div>
          </section>
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
