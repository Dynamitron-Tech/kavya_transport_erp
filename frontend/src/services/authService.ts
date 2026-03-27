import api from './api';
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '@/types';

const unwrap = <T = any>(payload: any): T => (payload?.data ?? payload) as T;

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const data = await api.post<LoginResponse>('/auth/login', credentials);
    return unwrap(data);
  },

  register: async (payload: RegisterRequest): Promise<User> => {
    const data = await api.post<User>('/auth/register', payload);
    return data;
  },

  getMe: async (): Promise<User> => {
    const data = await api.get<User>('/auth/me');
    return unwrap(data);
  },

  refreshToken: async (refreshToken: string): Promise<LoginResponse> => {
    const data = await api.post<LoginResponse>('/auth/refresh', { refresh_token: refreshToken });
    return unwrap(data);
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
