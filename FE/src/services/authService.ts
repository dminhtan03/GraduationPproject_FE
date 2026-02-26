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
import { ROUTES, STORAGE_KEYS } from "../constants";

// Max-age cho refresh token trong cookie: 7 ngày (theo BE 604800000 ms)
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 604800

// Decode JWT để lấy thông tin user (email, fullName...) từ payload
const decodeJwt = (token: string): any | null => {
  try {
    const [, payload] = token.split(".");
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
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

  const roles = parseRoles(payload.roles);
  const role = roles[0] ?? undefined;

  return {
    id: 0,
    name: payload.user || payload.fullName || payload.sub || "User",
    email: payload.sub || "",
    role,
    roles: roles.length ? roles : undefined,
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
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("user_data");
    } catch {}
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
    // Đưa refresh token vào cookies
    if (refreshToken) {
      document.cookie = `refresh_token=${encodeURIComponent(
        refreshToken,
      )}; path=/; max-age=${REFRESH_TOKEN_MAX_AGE_SECONDS}; secure`;
    }
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
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("user_data");
    } catch {}
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
    // Đưa refresh token vào cookies giống như login bằng email
    if (refreshToken) {
      document.cookie = `refresh_token=${encodeURIComponent(
        refreshToken,
      )}; path=/; max-age=${REFRESH_TOKEN_MAX_AGE_SECONDS}; secure`;
    }
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
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("user_data");
    } catch {}
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (): Promise<ApiResponse<any>> => {
  return await api.get(API_ENDPOINTS.AUTH.PROFILE);
};

/**
 * Trả về route mặc định sau khi login theo role (BE: ROLE_ADMIN, ROLE_USER, ROLE_MAKE...)
 */
export const getDefaultRouteByRole = (user: User | null): string => {
  if (!user?.role && !user?.roles?.length) return ROUTES.ROOM_LIST;
  const roles = user.roles ?? (user.role ? [user.role] : []);
  if (roles.some((r) => r === "ROLE_ADMIN" || (r && r.includes("ADMIN")))) {
    return ROUTES.ADMIN_DASHBOARD;
  }
  return ROUTES.ROOM_LIST;
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
