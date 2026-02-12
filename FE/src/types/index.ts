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

// Interface cho user (role từ JWT BE: sub=email, user=fullName, roles=ROLE_*)
export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  /** Role chính (từ JWT claim roles), e.g. "ROLE_ADMIN", "ROLE_USER" */
  role?: string;
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
  LOGIN: "/login",
  LOG_OUT: "/logout",
  ABOUT: "/about",
  DASHBOARD: "/dashboard",
} as const;

export type RoutesType = (typeof Routes)[keyof typeof Routes];

// Extended User interface for auth
export interface AuthUser extends User {
  verified?: boolean;
  role?: string;
}

// Auth state interface
export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Type cho WebSocket message
export interface WebSocketMessage {
  type: "update" | "notification" | "error";
  data: unknown;
  timestamp: string;
}

// ===== ROOM (Campus Room Inventory) =====
export type RoomStatus = "AVAILABLE" | "OCCUPIED";

export interface Room {
  id: string;
  roomName: string;
  /** e.g. "Floor 2 - Lab" */
  floorInfo?: string;
  building: string;
  /** Capacity / Slot */
  slot: number;
  status: RoomStatus;
  /** Optional category for filter: Tech Labs, Study Pods, Auditoriums */
  category?: string;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  department: string;
  email: string;
  gender: string;
}
