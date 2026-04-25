import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginWithEmail,
  loginWithGoogle,
  getDefaultRouteByRole,
} from "../../services/authService";
import { ROUTES } from "../../constants";
import CustomMessage, {
  MessageType,
} from "../../components/common/CustomMessage";
import { extractApiMessage } from "../../utils/errorHandlers";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { message } from "antd";
import { setAuthenticatedUser, useAppDispatch } from "../../store";
import campusBackground from "../../assets/image.png";

/* ===== Google types ===== */
type GoogleCredentialResponse = { credential?: string };

type GoogleInitializeConfig = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
};

type GoogleRenderButtonOptions = {
  theme: "outline" | "filled_blue" | "filled_black";
  size: "large" | "medium" | "small";
  width?: string | number;
};

type GoogleIdentity = {
  initialize: (config: GoogleInitializeConfig) => void;
  renderButton: (
    element: HTMLElement,
    options: GoogleRenderButtonOptions,
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentity;
      };
    };
  }
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [popup, setPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  const showPopup = (type: MessageType, message: string) => {
    setPopup({ type, message });
    setTimeout(() => setPopup(null), 3000);
  };

  /* ===== Email login ===== */
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setEmailError(null);
    setPasswordError(null);

    try {
      // Validate email & password
      const fptEmailRegex = /^[a-zA-Z0-9._%+-]+@fpt\.edu\.vn$/;

      let hasError = false;

      if (!email) {
        setEmailError("Email is required");
        hasError = true;
      } else if (!fptEmailRegex.test(email)) {
        setEmailError("Email must be in the format ...@fpt.edu.vn");
        hasError = true;
      }

      if (!password) {
        setPasswordError("Password is required");
        hasError = true;
      } else if (password.length < 6) {
        setPasswordError("Password must be at least 6 characters long");
        hasError = true;
      }

      if (hasError) {
        setLoading(false);
        return;
      }

      const res = await loginWithEmail({ email, password });

      if (res.success) {
        message.success(res.message || "Login successful");
        dispatch(setAuthenticatedUser(res.data?.user ?? null));
        const target = getDefaultRouteByRole(res.data?.user ?? null);
        navigate(target, { replace: true });
      } else {
        showPopup("error", res.message || "Login failed");
      }
    } catch (err: unknown) {
      const backendMessage = extractApiMessage(err, "Login failed");
      showPopup("error", backendMessage);
    } finally {
      setLoading(false);
    }
  };

  /* ===== Google login ===== */
  const handleGoogleLogin = useCallback(
    async (response: GoogleCredentialResponse) => {
      try {
        const token = response?.credential;
        if (!token) return;

        const res = await loginWithGoogle(token);
        if (res.success) {
          message.success(res.message || "Login with Google successful");
          dispatch(setAuthenticatedUser(res.data?.user ?? null));
          const target = getDefaultRouteByRole(res.data?.user ?? null);
          navigate(target, { replace: true });
        } else {
          showPopup("error", res.message || "Login with Google failed");
        }
      } catch (err: unknown) {
        const backendMessage = extractApiMessage(
          err,
          "Login with Google failed",
        );
        showPopup("error", backendMessage);
      }
    },
    [dispatch, navigate],
  );

  /* ===== Load Google ===== */
  React.useEffect(() => {
    const scriptId = "google-gsi-script";
    const buttonContainerId = "google-signin-button";

    const renderGoogleButton = () => {
      const buttonContainer = document.getElementById(buttonContainerId);
      if (!buttonContainer) return;

      const googleIdentity = window.google?.accounts?.id;
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!googleIdentity || !clientId) return;

      // Prevent duplicate button mounts in StrictMode/dev remount cycles.
      buttonContainer.innerHTML = "";

      googleIdentity.initialize({
        client_id: clientId,
        callback: handleGoogleLogin,
      });

      googleIdentity.renderButton(buttonContainer, {
        theme: "outline",
        size: "large",
        width: "100%",
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.getElementById(
      scriptId,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton);
      return () => {
        existingScript.removeEventListener("load", renderGoogleButton);
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [handleGoogleLogin]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f6fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_25px_80px_-30px_rgba(15,23,42,0.45)] backdrop-blur xl:grid-cols-[1.08fr_1fr]">
          <section
            className="relative hidden overflow-hidden bg-cover bg-center p-10 text-white xl:flex xl:flex-col"
            style={{ backgroundImage: `url(${campusBackground})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/45 to-slate-900/30" />
            <div className="absolute -right-14 top-16 h-56 w-56 rounded-full bg-orange-400/25 blur-2xl" />
            <div className="absolute bottom-8 left-8 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />

            <div className="relative z-10 fade-in">
              <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold tracking-[0.18em] text-orange-200">
                SMART CAMPUS EXPERIENCE
              </p>
              <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight">
                UniBook
              </h1>
              <p className="mt-3 max-w-md text-slate-200">
                Book meeting rooms faster with real-time availability, smart
                reminders, and a cleaner workflow for your day.
              </p>
            </div>

            <div className="relative z-10 mt-auto space-y-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">
                  Real-time room status
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Always see what is available before your team arrives.
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">
                  Unified booking history
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Keep track of upcoming and past reservations in one place.
                </p>
              </div>
            </div>
          </section>

          <section className="fade-in p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 text-center xl:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                  Welcome Back
                </p>
                <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  Login
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Sign in with your FPT account to continue.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleEmailLogin}>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    disabled={loading}
                    placeholder="yourname@fpt.edu.vn"
                    className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                      emailError
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                        : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
                    }`}
                  />
                  {emailError && (
                    <p className="mt-2 text-xs font-medium text-rose-500">
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      disabled={loading}
                      placeholder="Enter your password"
                      className={`w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                        passwordError
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                          : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
                      }`}
                    />

                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-orange-500"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="mt-2 text-xs font-medium text-rose-500">
                      {passwordError}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-semibold text-orange-500 transition hover:text-orange-600 hover:underline"
                    onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-base font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-sm font-medium text-slate-500">Or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div id="google-signin-button" className="min-h-[44px] w-full" />

              <div className="mt-7 grid gap-3 sm:grid-cols-3 xl:hidden">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-600">
                  Quick booking
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-600">
                  Live availability
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-600">
                  Amenity control
                </div>
              </div>
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

export default LoginPage;
