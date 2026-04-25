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
<<<<<<< HEAD
  roles?: string[];
=======
  /** Tất cả authorities từ BE */
  roles?: string[];
  cancellationCount: number;
  bookingLockedUntil: string;
>>>>>>> main
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

// ===== NOTIFICATIONS =====

export type NotificationCategory =
  | "system"
  | "ai"
  | "booking"
  | "batch"
  | "other";

export interface AppNotification {
  id: string;
  backendId?: string;
  title: string;
  message: string;
  createdAt: string;
  category?: NotificationCategory;
  read?: boolean;
  /** Optional progress for long-running jobs (0-100) */
  progress?: number;
  /** Optional short status label, e.g. "In progress", "Completed" */
  statusText?: string;
  reservationId?: string;
  reservationStatusAtNow?: string;
}

// ===== ROOM (Campus Room Inventory) =====
export type RoomStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "UNAVAILABLE"
  | "BROKEN"
  | "LEARNING";

export interface Room {
  id: string;
  roomName: string;
  building: string;
  floorInfo?: string;
  slot: number;
  status: RoomStatus;
}

export interface CreateReservationRequest {
  roomId: string;
  purpose: string;
  startTime: string;
  endTime: string;
  attendeeCount?: number;
  note?: string;
}

export type ReservationStatus =
  | "PENDING"
  | "APPROVED"
  | "IN_USE"
  | "CHECKED_IN"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | string;

export interface Reservation {
  id?: string;
  roomId?: string;
  locationCode?: string;
  floor?: string;
  address?: string;
  buildingName?: string;
  purpose?: string;
  note?: string;
  startTime?: string;
  endTime?: string;
  attendeeCount?: number;
  status?: ReservationStatus;
  feedbackId?: string;
  feedbackSubmitted?: boolean;
  rawData?: Record<string, unknown>;
}

export interface ReservationStatusQuery {
  page?: number;
  size?: number;
  locationCode?: string;
  address?: string;
  statuses?: string[];
  buildingId?: string;
  startTime?: string;
  endTime?: string;
}

export interface ReservationPageResult {
  items: Reservation[];
  total: number;
  page: number;
  size: number;
}

export interface Building {
  id: number;
  name: string;
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
  cancellationCount: number;
  bookingLockedUntil: Date;
}
