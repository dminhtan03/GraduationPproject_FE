// ===== CÁC HÀM XỬ LÝ LỖI =====

import { ApiError } from "../types";

const extractMessageFromPayload = (payload: unknown): string | null => {
  if (payload == null) return null;

  if (typeof payload === "string") {
    return payload.trim() || null;
  }

  if (typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  const errors = Array.isArray(data.errors) ? data.errors : null;
  const isGenericValidationMessage = (value: unknown) =>
    typeof value === "string" && value.trim().toLowerCase() === "validation failed";
  const extractFromErrors = (): string | null => {
    if (!errors) return null;
    for (const err of errors) {
      if (err && typeof err === "object") {
        const record = err as Record<string, unknown>;
        const direct = [record.defaultMessage, record.message, record.detail];
        for (const candidate of direct) {
          if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
          }
        }
      }

      const nested = extractMessageFromPayload(err);
      if (nested) return nested;
    }
    return null;
  };

  const directCandidates = [
    data.message,
    data.error,
    data.detail,
    data.reason,
    data.title,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const trimmed = candidate.trim();
      if (isGenericValidationMessage(trimmed)) {
        const detailed = extractFromErrors();
        if (detailed) return detailed;
      }
      return trimmed;
    }
  }

  if (data.meta && typeof data.meta === "object") {
    const meta = data.meta as Record<string, unknown>;
    if (typeof meta.message === "string" && meta.message.trim()) {
      return meta.message.trim();
    }
    if (typeof meta.error === "string" && meta.error.trim()) {
      return meta.error.trim();
    }
  }

  if (data.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
    for (const value of Object.values(data.errors)) {
      const nested = extractMessageFromPayload(value);
      if (nested) return nested;
    }
  }

  if (data.data != null) {
    const nested = extractMessageFromPayload(data.data);
    if (nested) return nested;
  }

  const nestedFromErrors = extractFromErrors();
  if (nestedFromErrors) return nestedFromErrors;

  return null;
};

// Xử lý lỗi API
export const handleApiError = (error: any): ApiError => {
  // Nếu là lỗi từ axios response
  if (error.response) {
    const data = error.response.data;
    const extractedMessage = extractMessageFromPayload(data);
    const message = extractedMessage || "Có lỗi xảy ra từ server";
    const code =
      (data && typeof data === "object" && "meta" in data
        ? (data as any)?.meta?.code
        : undefined) ??
      (data && typeof data === "object" ? (data as any)?.code : undefined);
    return {
      message,
      status: error.response.status,
      code,
    };
  }

  // Nếu là lỗi network
  if (error.request) {
    return {
      message: "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.",
      status: 0,
      code: "NETWORK_ERROR",
    };
  }

  // Lỗi khác
  return {
    message: error.message || "Có lỗi không xác định xảy ra",
    status: 500,
    code: "UNKNOWN_ERROR",
  };
};

// Log lỗi để debug
export const logError = (error: any, context?: string) => {
  console.group(`🚨 Lỗi${context ? ` - ${context}` : ""}`);
  console.error("Chi tiết lỗi:", error);
  console.error("Stack trace:", error.stack);
  console.groupEnd();
};

// Hiển thị thông báo lỗi thân thiện
export const getErrorMessage = (error: ApiError): string => {
  switch (error.status) {
    case 400:
      return "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.";
    case 401:
      return "Bạn cần đăng nhập để thực hiện thao tác này.";
    case 403:
      return "Bạn không có quyền thực hiện thao tác này.";
    case 404:
      return "Không tìm thấy dữ liệu yêu cầu.";
    case 500:
      return "Lỗi server. Vui lòng thử lại sau.";
    default:
      return error.message;
  }
};

export const extractApiMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === "object") {
    const apiError = error as Partial<ApiError>;
    if (typeof apiError.message === "string" && apiError.message.trim()) {
      return apiError.message;
    }

    const raw = error as {
      response?: { data?: unknown };
      data?: unknown;
      error?: unknown;
    };

    const responseMessage = extractMessageFromPayload(raw.response?.data);
    if (responseMessage) return responseMessage;

    const rawDataMessage = extractMessageFromPayload(raw.data);
    if (rawDataMessage) return rawDataMessage;

    const rawErrorMessage = extractMessageFromPayload(raw.error);
    if (rawErrorMessage) return rawErrorMessage;
  }

  try {
    const normalized = handleApiError(error as any);
    if (normalized.message && normalized.message.trim()) {
      return normalized.message;
    }
  } catch {
    // ignore and fallback
  }

  return fallback;
};
