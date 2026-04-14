// ===== CẤU HÌNH AXIOS CHO API CALLS =====

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { ApiResponse, ApiError } from "../types";
import { API_CONFIG, AUTH_EVENTS } from "../constants";
import { API_ENDPOINTS } from "../constants/endpoints";
import { handleApiError, logError } from "../utils/errorHandlers";
import {
  clearAccessToken,
  clearRefreshToken,
  getAccessToken,
  getRefreshToken,
  persistRefreshToken,
  setAccessToken,
} from "./authTokenStorage";

let refreshPromise: Promise<string | null> | null = null;
const DEFAULT_GET_DEDUPE_TTL_MS = 1200;
const PROFILE_GET_DEDUPE_TTL_MS = 5000;

type ApiRequestConfig = AxiosRequestConfig & {
  skipDedupe?: boolean;
  dedupeTtlMs?: number;
};

const inFlightGetRequests = new Map<string, Promise<ApiResponse<unknown>>>();
const recentGetResponses = new Map<
  string,
  { response: ApiResponse<unknown>; expiresAt: number }
>();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const stableSerialize = (value: unknown): string => {
  if (value == null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const sortedKeys = Object.keys(value).sort();
    const body = sortedKeys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
};

const buildGetRequestKey = (config: AxiosRequestConfig): string => {
  const url = String(config.url || "");
  const params = stableSerialize(config.params || null);
  const token = getAccessToken() || "anonymous";
  return `${url}::${params}::${token}`;
};

const clearGetRequestState = () => {
  inFlightGetRequests.clear();
  recentGetResponses.clear();
};

const emitAuthTokenChanged = () => {
  if (typeof window === "undefined") return;
  clearGetRequestState();
  window.dispatchEvent(new Event(AUTH_EVENTS.TOKEN_CHANGED));
};

const refreshAccessTokenOnce = async (
  instance: AxiosInstance,
): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const refreshResponse = await instance.post(
        `${API_ENDPOINTS.AUTH.REFRESH}?refreshToken=${encodeURIComponent(
          refreshToken,
        )}`,
      );

      const newAccessToken =
        refreshResponse.data?.data?.accessToken ||
        refreshResponse.data?.accessToken ||
        null;

      const newRefreshToken =
        refreshResponse.data?.data?.refreshToken ||
        refreshResponse.data?.refreshToken ||
        null;

      if (newAccessToken) {
        setAccessToken(newAccessToken);
      }

      if (newRefreshToken) {
        persistRefreshToken(newRefreshToken);
      }

      if (newAccessToken || newRefreshToken) {
        emitAuthTokenChanged();
      }

      return newAccessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

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
      const token = getAccessToken();
      // Do not attach Authorization for login/google-login/refresh endpoints.
      const isAuthRequest =
        config.url?.includes("/api/v1/auth/doLogin") ||
        config.url?.includes("/api/v1/auth/google-login") ||
        config.url?.includes(API_ENDPOINTS.AUTH.REFRESH);
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
    async (error) => {
      const apiError = handleApiError(error);
      logError(apiError, "Response Interceptor");

      const originalRequest: any = error.config || {};
      const requestUrl = String(originalRequest?.url || "");
      const isRefreshRequest = requestUrl.includes(API_ENDPOINTS.AUTH.REFRESH);
      const isLoginRequest =
        requestUrl.includes(API_ENDPOINTS.AUTH.LOGIN) ||
        requestUrl.includes(API_ENDPOINTS.AUTH.GOOGLE_LOGIN);
      const isLogoutRequest = requestUrl.includes(API_ENDPOINTS.AUTH.LOGOUT);

      // Nếu 401 lần đầu tiên, thử gọi refresh token
      if (
        apiError.status === 401 &&
        !originalRequest._retry &&
        !isRefreshRequest &&
        !isLoginRequest &&
        !isLogoutRequest
      ) {
        originalRequest._retry = true;
        try {
          const newAccessToken = await refreshAccessTokenOnce(instance);

          if (newAccessToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return instance(originalRequest);
          }
        } catch (refreshError) {
          logError(refreshError as ApiError, "Refresh Token Error");
        }
      }

      // Nếu vẫn 401 hoặc refresh thất bại, xoá token và đưa về login
      if (apiError.status === 401 && !isLoginRequest) {
        clearAccessToken();
        clearRefreshToken();
        emitAuthTokenChanged();
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
  config: ApiRequestConfig,
): Promise<ApiResponse<T>> => {
  const executeRequest = async (
    axiosConfig: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient(axiosConfig);

    return {
      data: response.data,
      message: "Success",
      success: true,
      status: response.status,
    };
  };

  const {
    skipDedupe = false,
    dedupeTtlMs = DEFAULT_GET_DEDUPE_TTL_MS,
    ...axiosConfig
  } = config;

  const method = String(axiosConfig.method || "GET").toUpperCase();
  const shouldDedupeGet =
    method === "GET" && Boolean(axiosConfig.url) && !skipDedupe;

  if (!shouldDedupeGet) {
    return executeRequest(axiosConfig);
  }

  const requestKey = buildGetRequestKey(axiosConfig);
  const now = Date.now();
  const cached = recentGetResponses.get(requestKey);
  if (cached && cached.expiresAt > now) {
    return cached.response as ApiResponse<T>;
  }

  if (cached) {
    recentGetResponses.delete(requestKey);
  }

  const inFlight = inFlightGetRequests.get(requestKey);
  if (inFlight) {
    return inFlight as Promise<ApiResponse<T>>;
  }

  const requestPromise = executeRequest(axiosConfig)
    .then((response) => {
      const isProfileRequest = String(axiosConfig.url || "").includes(
        API_ENDPOINTS.AUTH.PROFILE,
      );
      const ttlMs = Math.max(
        0,
        isProfileRequest
          ? Math.max(dedupeTtlMs, PROFILE_GET_DEDUPE_TTL_MS)
          : dedupeTtlMs,
      );
      recentGetResponses.set(requestKey, {
        response: response as ApiResponse<unknown>,
        expiresAt: Date.now() + ttlMs,
      });
      return response;
    })
    .finally(() => {
      inFlightGetRequests.delete(requestKey);
    });

  inFlightGetRequests.set(
    requestKey,
    requestPromise as Promise<ApiResponse<unknown>>,
  );

  return requestPromise;
};

// Các method HTTP shortcuts
export const api = {
  get: <T>(url: string, config?: ApiRequestConfig) =>
    apiCall<T>({ method: "GET", url, ...config }),

  post: <T>(url: string, data?: any, config?: ApiRequestConfig) =>
    apiCall<T>({ method: "POST", url, data, ...config }),

  put: <T>(url: string, data?: any, config?: ApiRequestConfig) =>
    apiCall<T>({ method: "PUT", url, data, ...config }),

  delete: <T>(url: string, config?: ApiRequestConfig) =>
    apiCall<T>({ method: "DELETE", url, ...config }),

  patch: <T>(url: string, data?: any, config?: ApiRequestConfig) =>
    apiCall<T>({ method: "PATCH", url, data, ...config }),
};
