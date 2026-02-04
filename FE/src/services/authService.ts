// ===== AUTH SERVICE =====

import { api } from "./api";
import { ApiResponse, User } from "../types";
import {
  BackendAuthData,
  BackendResponse,
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
} from "../types/api";
import { API_ENDPOINTS } from "../constants/endpoints";
import { STORAGE_KEYS } from "../constants";

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

// Chuẩn hoá dữ liệu user từ JWT payload (BE set claim "user" = fullName, "sub" = email)
const extractUserFromToken = (accessToken: string | undefined): User | null => {
  if (!accessToken) return null;
  const payload = decodeJwt(accessToken);
  if (!payload) return null;

  return {
    id: 0, // BE không trả id, tạm thời set 0
    name: payload.user || payload.fullName || payload.sub || "User",
    email: payload.sub || "",
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
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
    localStorage.setItem("refresh_token", refreshToken || "");
  }

  const user = extractUserFromToken(accessToken);
  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  }

  return {
    ...response,
    data: {
      user,
      accessToken: accessToken || "",
      refreshToken: refreshToken || "",
    },
  };
};

export const loginWithGoogle = async (
  googleToken: string,
): Promise<ApiResponse<LoginResponse>> => {
  const response = await api.post<BackendResponse<BackendAuthData>>(
    API_ENDPOINTS.AUTH.GOOGLE_LOGIN,
    {
      token: googleToken,
    } as GoogleLoginRequest,
  );

  const backendData = response.data;
  const accessToken = backendData?.data?.accessToken;
  const refreshToken = backendData?.data?.refreshToken;

  if (accessToken) {
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
    localStorage.setItem("refresh_token", refreshToken || "");
  }

  const user = extractUserFromToken(accessToken);
  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  }

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
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (): Promise<ApiResponse<any>> => {
  return await api.get(API_ENDPOINTS.AUTH.PROFILE);
};
