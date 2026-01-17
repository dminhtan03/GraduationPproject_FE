// ===== TYPES CHUNG CHO TOÀN BỘ ỨNG DỤNG =====

// Interface cho response API
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
  status: number;
}

// Interface cho error
export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// Interface cho loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// Interface cho user
export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

// Interface cho data demo
export interface DemoData {
  id: number;
  title: string;
  value: number;
  timestamp: string;
}

// Type cho routes thay vì enum
export const Routes = {
  HOME: "/",
  ABOUT: "/about",
  DASHBOARD: "/dashboard",
} as const;

export type RoutesType = (typeof Routes)[keyof typeof Routes];

// Type cho WebSocket message
export interface WebSocketMessage {
  type: "update" | "notification" | "error";
  data: unknown;
  timestamp: string;
}
