// ===== CẤU HÌNH AXIOS CHO API CALLS =====

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { ApiResponse, ApiError } from "../types";
import { API_CONFIG, STORAGE_KEYS } from "../constants";
import { handleApiError, logError } from "../utils/errorHandlers";

// Tạo axios instance với config cơ bản
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor - thêm token vào header
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      // Không thêm Authorization cho login và google-login
      const isAuthRequest =
        config.url?.includes("/api/v1/auth/doLogin") ||
        config.url?.includes("/api/v1/auth/google-login");
      if (token && !isAuthRequest) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log request cho development
      console.log("🚀 API Request:", {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      });

      return config;
    },
    (error) => {
      logError(error, "Request Interceptor");
      return Promise.reject(error);
    },
  );

  // Response interceptor - xử lý response và error
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log response cho development
      console.log("✅ API Response:", {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });

      return response;
    },
    (error) => {
      const apiError = handleApiError(error);
      logError(apiError, "Response Interceptor");

      // Nếu lỗi 401, redirect về login
      if (apiError.status === 401) {
        localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        // TODO: Redirect to login page
        window.location.href = "/login";
      }

      return Promise.reject(apiError);
    },
  );

  return instance;
};

// Axios instance chính
export const apiClient = createAxiosInstance();

// Generic API call function
export const apiCall = async <T>(
  config: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient(config);

    // Format response theo chuẩn ApiResponse
    return {
      data: response.data,
      message: "Success",
      success: true,
      status: response.status,
    };
  } catch (error) {
    throw error;
  }
};

// Các method HTTP shortcuts
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiCall<T>({ method: "GET", url, ...config }),

  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiCall<T>({ method: "POST", url, data, ...config }),

  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiCall<T>({ method: "PUT", url, data, ...config }),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiCall<T>({ method: "DELETE", url, ...config }),

  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiCall<T>({ method: "PATCH", url, data, ...config }),
};
