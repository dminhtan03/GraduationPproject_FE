// ===== DEMO API SERVICES =====

import { api } from "./api";
import { API_ENDPOINTS } from "../constants/endpoints";
import { DemoData, User } from "../types";

// Service để lấy danh sách posts từ JSONPlaceholder
export const demoApiService = {
  // Lấy danh sách posts
  getPosts: async (limit: number = 10) => {
    return api.get<any[]>(`${API_ENDPOINTS.DEMO.POSTS}?_limit=${limit}`);
  },

  // Lấy chi tiết post
  getPost: async (id: number) => {
    return api.get<any>(`${API_ENDPOINTS.DEMO.POSTS}/${id}`);
  },

  // Lấy danh sách users
  getUsers: async () => {
    return api.get<User[]>(API_ENDPOINTS.DEMO.USERS || "/users");
  },

  // Lấy todos để demo loading state
  getTodos: async (page: number = 1, limit: number = 10) => {
    const start = (page - 1) * limit;
    return api.get<any[]>(
      `${API_ENDPOINTS.DEMO.TODOS}?_start=${start}&_limit=${limit}`
    );
  },

  // Tạo post mới (demo POST request)
  createPost: async (data: { title: string; body: string; userId: number }) => {
    return api.post<any>(API_ENDPOINTS.DEMO.POSTS, data);
  },

  // Update post (demo PUT request)
  updatePost: async (
    id: number,
    data: { title: string; body: string; userId: number }
  ) => {
    return api.put<any>(`${API_ENDPOINTS.DEMO.POSTS}/${id}`, data);
  },

  // Delete post (demo DELETE request)
  deletePost: async (id: number) => {
    return api.delete<any>(`${API_ENDPOINTS.DEMO.POSTS}/${id}`);
  },
};

// Service để demo live data (sẽ kết hợp với WebSocket)
export const liveDataService = {
  // Simulate live data từ server
  getLiveData: async (): Promise<DemoData[]> => {
    // Tạo fake data cho demo
    const mockData: DemoData[] = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      title: `Live Data ${index + 1}`,
      value: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
    }));

    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return mockData;
  },
};
