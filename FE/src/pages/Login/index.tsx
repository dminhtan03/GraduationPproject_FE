import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithEmail, loginWithGoogle } from "../../services/authService";
import { ROUTES } from "../../constants";
import "../../styles/Login.css";

// Google Sign-In button component

type GoogleCredentialResponse = { credential?: string };

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback: (resp: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (
    el: HTMLElement,
    options?: { theme?: string; size?: string; width?: string | number },
  ) => void;
};

type WindowGoogle = {
  accounts: { id: GoogleAccountsId };
};

declare global {
  interface Window {
    google?: WindowGoogle;
  }
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle email/password login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email || !password) {
        setError("Vui lòng nhập email và mật khẩu");
        setLoading(false);
        return;
      }

      const response = await loginWithEmail({
        email,
        password,
      });

      if (response.success) {
        console.log(" Login successful, redirecting to dashboard");
        navigate(ROUTES.DASHBOARD);
      } else {
        setError(response.message || "Login failed");
      }
    } catch (err: unknown) {
      console.error("Login error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err) || "Có lỗi xảy ra khi đăng nhập");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google login
  const handleGoogleLogin = React.useCallback(
    async (response: GoogleCredentialResponse) => {
      setError("");
      setLoading(true);

      try {
        const googleToken = response?.credential;

        if (!googleToken) {
          setError("Không thể lấy token từ Google");
          setLoading(false);
          return;
        }

        const result = await loginWithGoogle(googleToken);

        if (result.success) {
          console.log("[v0] Google login successful, redirecting to dashboard");
          navigate(ROUTES.DASHBOARD);
        } else {
          setError(result.message || "Đăng nhập Google thất bại");
        }
      } catch (err: unknown) {
        console.error("[v0] Google login error:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err) || "Có lỗi xảy ra khi đăng nhập bằng Google");
        }
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  // Initialize Google Sign-In
  React.useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id:
            import.meta.env.VITE_GOOGLE_CLIENT_ID ||
            "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
          callback: handleGoogleLogin,
        });

        const googleButton = document.getElementById("google-signin-button");
        if (googleButton) {
          window.google.accounts.id.renderButton(googleButton, {
            theme: "outline",
            size: "large",
            width: "100%",
          });
        }
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [handleGoogleLogin]);

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Logo Section */}
        <div className="login-header">
          <div className="logo">
            <span className="logo-icon">📚</span>
          </div>
          <h1>UniBook</h1>
          <p>Smart Booking System</p>
        </div>

        {/* Form Section */}
        <div className="login-form-wrapper">
          <h2>Login</h2>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* Divider */}
          <div className="divider">
            <span>Or</span>
          </div>

          {/* Google Login Button */}
          <div id="google-signin-button" className="google-button"></div>

          {/* Forgot Password Link */}
          <p className="forgot-password-text">
            <a href="#forgot-password" className="forgot-password-link">
              Forgot Password?
            </a>
          </p>
        </div>

        {/* Features Section */}
        <div className="login-features">
          <h3>Main Features</h3>
          <ul>
            <li>
              <span className="feature-icon">✓</span>
              <span>Quick Meeting Room Booking</span>
            </li>
            <li>
              <span className="feature-icon">✓</span>
              <span>Real-time Availability Check</span>
            </li>
            <li>
              <span className="feature-icon">✓</span>
              <span>Room Amenities Management</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right Panel with Design */}
      <div className="login-illustration">
        <div className="illustration-content">
          <h2>Welcome!</h2>
          <p>UniBook helps you manage meeting rooms efficiently</p>
          <div className="illustration-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
