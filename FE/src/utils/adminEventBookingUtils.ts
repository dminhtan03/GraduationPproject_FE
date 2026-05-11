import { API_CONFIG } from "../constants";

export const normalizeSockJsUrl = () => {
  const fallback = "http://localhost:8080/websocket";
  const input = (API_CONFIG.WEBSOCKET_URL || fallback).trim();
  try {
    if (/^wss?:\/\//i.test(input)) return input.replace(/^ws/i, "http");
    return input;
  } catch {
    return fallback;
  }
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      response?: { data?: { message?: unknown } };
    };

    const responseMessage = maybeError.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (typeof maybeError.message === "string" && maybeError.message.trim()) {
      return maybeError.message;
    }
  }

  return fallback;
};
