// ===== TYPES DÀNH CHO API =====
import { ApiResponse, ApiError, User, DemoData } from "./index";

// ===== REQUEST TYPES =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  token: string;
}

export interface GetDataRequest {
  page?: number;
  limit?: number;
  search?: string;
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

// API endpoint types
export type LoginApi = (
  data: LoginRequest
) => Promise<ApiResponse<LoginResponse>>;
export type GetDataApi = (
  params: GetDataRequest
) => Promise<ApiResponse<GetDataResponse>>;
export type GetUserApi = () => Promise<ApiResponse<User>>;
