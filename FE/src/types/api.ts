// ===== TYPES DÀNH CHO API =====
import { ApiResponse, ApiError, User, DemoData } from "./index";

// Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface GetDataRequest {
  page?: number;
  limit?: number;
  search?: string;
}

// Response types
export interface LoginResponse {
  user: User;
  token: string;
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
