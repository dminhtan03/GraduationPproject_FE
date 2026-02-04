// ===== AUTH SERVICE =====

import { api } from "./api";
import { ApiResponse } from "../types";
import { LoginRequest, LoginResponse, GoogleLoginRequest } from "../types/api";
import { API_ENDPOINTS } from "../constants/endpoints";
import { STORAGE_KEYS } from "../constants";

/**
 * Login with email and password
 */ export const loginWithEmail = async (
  credentials: LoginRequest,
): Promise<ApiResponse<LoginResponse>> => {
  const response = await api.post<any>(API_ENDPOINTS.AUTH.LOGIN, credentials);
  if (response.success && response.data && response.data.accessToken) {
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, response.data.accessToken);
    // lưu refreshToken
    localStorage.setItem("refresh_token", response.data.refreshToken || "");
  }
  return {
    ...response,
    data: {
      user: undefined, // Không có user từ BE
      token: response.data?.accessToken,
      refreshToken: response.data?.refreshToken,
    } as unknown as LoginResponse,
  };
};

export const loginWithGoogle = async (
  googleToken: string,
): Promise<ApiResponse<LoginResponse>> => {
  const response = await api.post<any>(API_ENDPOINTS.AUTH.GOOGLE_LOGIN, {
    token: googleToken,
  } as GoogleLoginRequest);
  if (response.success && response.data && response.data.accessToken) {
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, response.data.accessToken);
    localStorage.setItem("refresh_token", response.data.refreshToken || "");
  }
  return {
    ...response,
    data: {
      user: undefined,
      token: response.data?.accessToken,
      refreshToken: response.data?.refreshToken,
    } as unknown as LoginResponse,
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
