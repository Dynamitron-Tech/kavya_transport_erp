import api from './api';
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '@/types';

// Backend returns { success, data, message } - extract the data part
export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const data = await api.post<{ success: boolean; data: LoginResponse; message: string }>('/auth/login', credentials);
    return data.data ?? data;
  },

  register: async (payload: RegisterRequest): Promise<User> => {
    const data = await api.post<{ success: boolean; data: User; message: string }>('/auth/register', payload);
    return data.data ?? data;
  },

  getMe: async (): Promise<User> => {
    const data = await api.get<{ success: boolean; data: User; message: string }>('/auth/me');
    return data.data ?? data;
  },

  refreshToken: async (refreshToken: string): Promise<LoginResponse> => {
    const data = await api.post<{ success: boolean; data: LoginResponse; message: string }>('/auth/refresh', { refresh_token: refreshToken });
    return data.data ?? data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await api.post('/auth/reset-password', { token, new_password: newPassword });
  },

  logout: async (): Promise<void> => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};
