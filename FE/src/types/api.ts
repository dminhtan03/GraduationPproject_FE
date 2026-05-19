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

export interface AiMenuOption {
  code: string;
  label: string;
  intent: string;
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

export interface AiRoomDetailDto {
  id?: string;
  locationCode?: string;
  capacity?: number | null;
  score?: number | null;
  currentUserId?: string;
  currentUserName?: string;
  checkInTime?: string;
  amenities?: string[];
  images?: string[];
  feedbacks?: Array<{
    id?: string;
    rating?: number | null;
    description?: string;
    createdAt?: string;
  }>;
}

export interface AiBookingItem {
  id: string;
  label: string;
  roomCode: string;
  startTime: string;
  endTime: string;
}

export interface AiChatResponseDto {
  sessionId?: string;
  reply: string;
  message?: string;
  intent?: string;
  suggestionType?: "available" | "alternative" | "suggested";
  suggestions?: AiRoomSuggestion[];
  menuOptions?: AiMenuOption[];
  roomDetail?: AiRoomDetailDto | null;
  reservationCreated: boolean;
  reservation?: Reservation | null;
  bookingItems?: AiBookingItem[];
}

// API endpoint types
export type LoginApi = (
  data: LoginRequest,
) => Promise<ApiResponse<LoginResponse>>;
export type GetDataApi = (
  params: GetDataRequest,
) => Promise<ApiResponse<GetDataResponse>>;
export type GetUserApi = () => Promise<ApiResponse<User>>;
