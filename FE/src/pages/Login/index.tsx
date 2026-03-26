import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginWithEmail,
  loginWithGoogle,
  getDefaultRouteByRole,
  restoreSession,
} from "../../services/authService";
import { ROUTES } from "../../constants";
import type { ApiError } from "../../types";
import CustomMessage, {
  MessageType,
} from "../../components/common/CustomMessage";
import { extractApiMessage } from "../../utils/errorHandlers";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import "../../styles/Login.css";

/* ===== Google types ===== */
type GoogleCredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: any;
  }
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const restoredRef = useRef(false);

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
        showPopup("success", "Login successful");
        const target = getDefaultRouteByRole(res.data?.user ?? null);
        setTimeout(() => navigate(target), 800);
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
  const handleGoogleLogin = async (response: GoogleCredentialResponse) => {
    try {
      const token = response?.credential;
      if (!token) return;

      const res = await loginWithGoogle(token);
      if (res.success) {
        const target = getDefaultRouteByRole(res.data?.user ?? null);
        navigate(target);
      }
    } catch {
      showPopup("error", "Login with Google failed");
    }
  };

  React.useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    let isMounted = true;

    const tryRestoreSession = async () => {
      const user = await restoreSession();
      if (!isMounted || !user) return;

      const target = getDefaultRouteByRole(user);
      navigate(target, { replace: true });
    };

    tryRestoreSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  /* ===== Load Google ===== */
  React.useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin,
      });

      window.google?.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        { theme: "outline", size: "large", width: "100%" },
      );
    };
  }, []);

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-header">
          <h1>UniBook</h1>
          <p>Smart Booking System</p>
        </div>

        <div className="login-form-wrapper">
          <h2>Login</h2>

          <form className="login-form" onSubmit={handleEmailLogin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                disabled={loading}
                className={emailError ? "input-invalid" : ""}
              />
              {emailError && (
                <p className="input-error-message">{emailError}</p>
              )}
            </div>

            <div className="form-group">
              <label>Password</label>

              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  disabled={loading}
                  className={passwordError ? "input-invalid" : ""}
                />

                <span
                  className="password-toggle"
                  onClick={() => setShowPassword((p) => !p)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </span>
              </div>
              {passwordError && (
                <p className="input-error-message">{passwordError}</p>
              )}
            </div>

            <div className="form-footer">
              <button
                type="button"
                className="link-button"
                onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
              >
                Forgot password?
              </button>
            </div>

            <button className="btn-login" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="divider">
            <span>Or</span>
          </div>

          <div id="google-signin-button" className="google-button"></div>
        </div>

        <div className="login-features">
          <h3>Main Features</h3>
          <ul>
            <li>✓ Quick Meeting Room Booking</li>
            <li>✓ Real-time Availability Check</li>
            <li>✓ Room Amenities Management</li>
          </ul>
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
