// ===== AUTH SERVICE =====

import { api } from "./api";
import { ApiResponse, User } from "../types";
import {
  BackendAuthData,
  BackendResponse,
  LoginRequest,
  LoginResponse,
  ForgotPasswordRequest,
  VerifyOtpRequest,
  ResendOtpRequest,
  ChangePasswordRequest,
  BasicMessageResponse,
} from "../types/api";
import { API_ENDPOINTS } from "../constants/endpoints";
import { AUTH_EVENTS, ROUTES } from "../constants";
import {
  clearAccessToken,
  clearRefreshToken,
  getAccessToken,
  getRefreshToken,
  persistRefreshToken,
  setAccessToken,
} from "./authTokenStorage";

const emitAuthTokenChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENTS.TOKEN_CHANGED));
};

// Decode JWT để lấy thông tin user (email, fullName...) từ payload
const decodeJwt = (token: string): Record<string, unknown> | null => {
  try {
    const [, payload] = token.split(".");
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const isTokenExpired = (payload: Record<string, unknown>): boolean => {
  const exp = payload.exp;
  if (typeof exp !== "number") return true;
  return exp * 1000 <= Date.now();
};

// Chuẩn hoá dữ liệu user từ JWT payload (BE: user=fullName, sub=email, roles=authorities)
const parseRoles = (roles: unknown): string[] => {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r: unknown) =>
      typeof r === "string"
        ? r
        : ((r as { authority?: string })?.authority ?? ""),
    )
    .filter(Boolean);
};

const extractBackendMessage = (
  payload: BackendResponse<unknown> | undefined,
  fallback: string,
): string => {
  if (!payload) return fallback;

  if (
    typeof payload.meta?.message === "string" &&
    payload.meta.message.trim()
  ) {
    return payload.meta.message;
  }

  const data = payload.data as { message?: unknown } | undefined;
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  return fallback;
};

const extractUserFromToken = (accessToken: string | undefined): User | null => {
  if (!accessToken) return null;
  const payload = decodeJwt(accessToken);
  if (!payload) return null;
  if (isTokenExpired(payload)) return null;

  const roles = parseRoles(payload.roles);
  const role = roles[0] ?? undefined;

  return {
    id: 0,
    name: String(payload.user || payload.fullName || payload.sub || "User"),
    email: String(payload.sub || ""),
    role,
    roles: roles.length ? roles : undefined,
    cancellationCount: 0,
    // Keep Redux auth state serializable by storing ISO string instead of Date object.
    bookingLockedUntil: new Date(0).toISOString(),
  };
};
/**
 * Login with email and password
 */
export const loginWithEmail = async (
  credentials: LoginRequest,
): Promise<ApiResponse<LoginResponse>> => {
  const response = await api.post<BackendResponse<BackendAuthData>>(
    API_ENDPOINTS.AUTH.LOGIN,
    credentials,
  );

  const backendData = response.data;
  const accessToken = backendData?.data?.accessToken;
  const refreshToken = backendData?.data?.refreshToken;

  if (accessToken) {
    localStorage.removeItem("user");
    localStorage.removeItem("user_data");
    setAccessToken(accessToken);
    if (refreshToken) {
      persistRefreshToken(refreshToken);
    }
    emitAuthTokenChanged();
  }

  return {
    ...response,
    message: extractBackendMessage(backendData, "Login successful"),
    data: {
      user: extractUserFromToken(accessToken),
      accessToken: accessToken || "",
      refreshToken: refreshToken || "",
    },
  };
};

/** Google login: gửi idToken (credential từ Google Sign-In) lên BE POST /api/v1/auth/google-login */
export const loginWithGoogle = async (
  idToken: string,
): Promise<ApiResponse<LoginResponse>> => {
  // Đảm bảo truyền đúng key là idToken cho backend
  const response = await api.post<BackendResponse<BackendAuthData>>(
    API_ENDPOINTS.AUTH.GOOGLE_LOGIN,
    { idToken },
  );

  const backendData = response.data;
  const accessToken = backendData?.data?.accessToken;
  const refreshToken = backendData?.data?.refreshToken;

  if (accessToken) {
    localStorage.removeItem("user");
    localStorage.removeItem("user_data");
    setAccessToken(accessToken);
    if (refreshToken) {
      persistRefreshToken(refreshToken);
    }
    emitAuthTokenChanged();
  }

  const user = extractUserFromToken(accessToken);

  return {
    ...response,
    message: extractBackendMessage(backendData, "Login with Google successful"),
    data: {
      user,
      accessToken: accessToken || "",
      refreshToken: refreshToken || "",
    },
  };
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    await api.post(API_ENDPOINTS.AUTH.LOGOUT);
  } finally {
    clearAccessToken();
    clearRefreshToken();
    localStorage.removeItem("user");
    localStorage.removeItem("user_data");
    emitAuthTokenChanged();
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (): Promise<ApiResponse<unknown>> => {
  return await api.get(API_ENDPOINTS.AUTH.PROFILE);
};

/**
 * Trả về route mặc định sau khi login theo role (BE: ROLE_ADMIN, ROLE_USER, ROLE_MAKE...)
 */
export const getDefaultRouteByRole = (user: User | null): string => {
  if (!user?.role && !user?.roles?.length) return ROUTES.HOME;
  const roles = user.roles ?? (user.role ? [user.role] : []);
  if (roles.some((r) => r === "ROLE_ADMIN" || r === "ADMIN")) {
    return ROUTES.ADMIN_DASHBOARD;
  }
  return ROUTES.HOME;
};

export const isAdminUser = (user: User | null): boolean => {
  if (!user) return false;
  const roles = user.roles ?? (user.role ? [user.role] : []);
  return roles.some((role) => role === "ROLE_ADMIN" || role === "ADMIN");
};

export const getCurrentUser = (): User | null => {
  const token = getAccessToken();
  const user = extractUserFromToken(token || undefined);
  if (!user && token) {
    clearAccessToken();
  }
  return user;
};

/**
 * Khôi phục phiên đăng nhập khi reload app:
 * - Ưu tiên access token trong localStorage
 * - Nếu không có access token nhưng còn refresh cookie, gọi refresh để lấy token mới
 */
export const restoreSession = async (): Promise<User | null> => {
  const storedAccessToken = getAccessToken();
  const userFromStoredToken = extractUserFromToken(
    storedAccessToken || undefined,
  );
  if (userFromStoredToken) {
    return userFromStoredToken;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshResponse = await api.post<BackendResponse<BackendAuthData>>(
      `${API_ENDPOINTS.AUTH.REFRESH}?refreshToken=${encodeURIComponent(
        refreshToken,
      )}`,
    );

    const accessToken =
      refreshResponse.data?.data?.accessToken ||
      (refreshResponse.data as unknown as { accessToken?: string })
        ?.accessToken;

    const newRefreshToken =
      refreshResponse.data?.data?.refreshToken ||
      (refreshResponse.data as unknown as { refreshToken?: string })
        ?.refreshToken;

    if (!accessToken) {
      return null;
    }

    setAccessToken(accessToken);
    if (newRefreshToken) {
      persistRefreshToken(newRefreshToken);
    }

    emitAuthTokenChanged();

    return extractUserFromToken(accessToken);
  } catch {
    clearAccessToken();
    clearRefreshToken();
    emitAuthTokenChanged();
    return null;
  }
};

const extractMessage = (
  payload?: BackendResponse<BasicMessageResponse> | null,
  fallback?: string,
): string => {
  if (!payload) return fallback || "";
  return (
    payload.meta?.message ||
    payload.data?.message ||
    fallback ||
    "Action completed"
  );
};

/**
 * Step 1: request OTP for forgot password
 */
export const requestPasswordReset = async (
  payload: ForgotPasswordRequest,
): Promise<ApiResponse<BasicMessageResponse>> => {
  const response = await api.post<BackendResponse<BasicMessageResponse>>(
    API_ENDPOINTS.USERS.FORGOT_PASSWORD_REQUEST,
    payload,
  );

  return {
    ...response,
    data: {
      message: extractMessage(response.data, "OTP has been sent to your email"),
    },
  };
};

/**
 * Step 2: verify OTP so backend issues a temporary password
 */
export const verifyResetOtp = async (
  payload: VerifyOtpRequest,
): Promise<ApiResponse<BasicMessageResponse>> => {
  const response = await api.post<BackendResponse<BasicMessageResponse>>(
    API_ENDPOINTS.USERS.FORGOT_PASSWORD_VERIFY,
    payload,
  );

  return {
    ...response,
    data: {
      message: extractMessage(
        response.data,
        "OTP verified. Please check your email for the temporary password.",
      ),
    },
  };
};

/**
 * Resend OTP when previous OTP expired
 */
export const resendResetOtp = async (
  payload: ResendOtpRequest,
): Promise<ApiResponse<BasicMessageResponse>> => {
  const response = await api.post<BackendResponse<BasicMessageResponse>>(
    API_ENDPOINTS.USERS.RESEND_OTP,
    payload,
  );

  return {
    ...response,
    data: {
      message: extractMessage(
        response.data,
        "OTP has been resent to your email",
      ),
    },
  };
};

/**
 * Final step: change password after logging in with the temporary one
 */
export const changePassword = async (
  payload: ChangePasswordRequest,
): Promise<ApiResponse<BasicMessageResponse>> => {
  const response = await api.post<BackendResponse<BasicMessageResponse>>(
    API_ENDPOINTS.USERS.CHANGE_PASSWORD,
    {
      currentPassword: payload.currentPassword,
      oldPassword: payload.currentPassword,
      newPassword: payload.newPassword,
      confirmPassword: payload.confirmPassword,
      confirmNewPassword: payload.confirmPassword,
    },
  );

  return {
    ...response,
    data: {
      message: extractMessage(
        response.data,
        "Your password has been updated successfully.",
      ),
    },
  };
};
