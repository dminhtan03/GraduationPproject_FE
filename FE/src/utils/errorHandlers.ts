// ===== CÁC HÀM XỬ LÝ LỖI =====

import { ApiError } from "../types";

// Xử lý lỗi API
export const handleApiError = (error: any): ApiError => {
  // Nếu là lỗi từ axios response
  if (error.response) {
    return {
      message: error.response.data?.message || "Có lỗi xảy ra từ server",
      status: error.response.status,
      code: error.response.data?.code,
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
