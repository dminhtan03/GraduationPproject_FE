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
import { AUTH_EVENTS, ROUTES, STORAGE_KEYS } from "../constants";

// Max-age cho refresh token trong cookie: 7 ngày (theo BE 604800000 ms)
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 604800

const setRefreshTokenCookie = (refreshToken: string) => {
  const secureFlag =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; secure"
      : "";

  document.cookie = `refresh_token=${encodeURIComponent(
    refreshToken,
  )}; path=/; max-age=${REFRESH_TOKEN_MAX_AGE_SECONDS}; samesite=lax${secureFlag}`;
};

const clearRefreshTokenCookie = () => {
  const secureFlag =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; secure"
      : "";

  document.cookie = `refresh_token=; path=/; max-age=0; samesite=lax${secureFlag}`;
};

const getRefreshTokenFromCookie = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )refresh_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

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
    bookingLockedUntil: new Date(0),
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
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
    // Save refresh token in cookie for auto-refresh flow
    if (refreshToken) {
      setRefreshTokenCookie(refreshToken);
    }
    emitAuthTokenChanged();
  }

  return {
    ...response,
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
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
    // Save refresh token in cookie for auto-refresh flow
    if (refreshToken) {
      setRefreshTokenCookie(refreshToken);
    }
    emitAuthTokenChanged();
  }

  const user = extractUserFromToken(accessToken);

  return {
    ...response,
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
    localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
    clearRefreshTokenCookie();
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
  if (!user?.role && !user?.roles?.length) return ROUTES.ROOM_LIST;
  const roles = user.roles ?? (user.role ? [user.role] : []);
  if (roles.some((r) => r === "ROLE_ADMIN" || r === "ADMIN")) {
    return ROUTES.ADMIN_DASHBOARD;
  }
  return ROUTES.ROOM_LIST;
};

export const isAdminUser = (user: User | null): boolean => {
  if (!user) return false;
  const roles = user.roles ?? (user.role ? [user.role] : []);
  return roles.some((role) => role === "ROLE_ADMIN" || role === "ADMIN");
};

export const getCurrentUser = (): User | null => {
  const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
  const user = extractUserFromToken(token || undefined);
  if (!user && token) {
    localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
  }
  return user;
};

/**
 * Khôi phục phiên đăng nhập khi reload app:
 * - Ưu tiên access token trong localStorage
 * - Nếu không có access token nhưng còn refresh cookie, gọi refresh để lấy token mới
 */
export const restoreSession = async (): Promise<User | null> => {
  const storedAccessToken = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
  const userFromStoredToken = extractUserFromToken(
    storedAccessToken || undefined,
  );
  if (userFromStoredToken) {
    return userFromStoredToken;
  }

  const refreshToken = getRefreshTokenFromCookie();
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

    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
    if (newRefreshToken) {
      setRefreshTokenCookie(newRefreshToken);
    }

    emitAuthTokenChanged();

    return extractUserFromToken(accessToken);
  } catch {
    localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
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
