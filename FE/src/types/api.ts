// ===== TYPES DÀNH CHO API =====
import {
  ApiResponse,
  ApiError,
  User,
  DemoData,
  Reservation,
  RoomStatus,
} from "./index";

// ===== REQUEST TYPES =====
export interface LoginRequest {
  email: string;
  password: string;
}

/** BE AuthController expects body: { idToken: string } */
export interface GoogleLoginRequest {
  idToken: string;
}

export interface GetDataRequest {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ResendOtpRequest {
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface BasicMessageResponse {
  message: string;
}

// ===== BACKEND RESPONSE STRUCTURE =====
// BE trả về dạng: { data: { accessToken, refreshToken }, meta: { code, message, ... } }
export interface BackendMeta {
  code: string;
  page?: number;
  size?: number;
  pages?: number;
  total?: number;
  message?: string;
}

export interface BackendAuthData {
  accessToken: string;
  refreshToken: string;
}

export interface BackendResponse<T> {
  data: T;
  meta: BackendMeta;
}

// ===== FE RESPONSE TYPES =====
export interface LoginResponse {
  user: User | null;
  accessToken: string;
  refreshToken: string;
}

export interface GetDataResponse {
  items: DemoData[];
  total: number;
  page: number;
  totalPages: number;
}

// ===== AI ASSISTANT TYPES =====

export interface AiChatRequestDto {
  message: string;
  sessionId?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
}

export interface AiRoomSuggestion {
  roomId: string;
  locationCode: string;
  score?: number | null;
  status: RoomStatus | string;
  building?: string;
  floor?: string;
  capacity?: number | null;
  amenities?: string[];
  imageUrl?: string;
  availableTimeSlots?: string[];
}

export interface AiChatResponseDto {
  sessionId?: string;
  reply: string;
  suggestions?: AiRoomSuggestion[];
  reservationCreated: boolean;
  reservation?: Reservation | null;
}

// API endpoint types
export type LoginApi = (
  data: LoginRequest,
) => Promise<ApiResponse<LoginResponse>>;
export type GetDataApi = (
  params: GetDataRequest,
) => Promise<ApiResponse<GetDataResponse>>;
export type GetUserApi = () => Promise<ApiResponse<User>>;
