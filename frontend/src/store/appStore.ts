import { create } from 'zustand';
import type { Notification, Alert } from '@/types';

interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  clearNotifications: () => void;

  // Alerts
  activeAlerts: Alert[];
  addAlert: (alert: Alert) => void;
  removeAlert: (id: string) => void;

  // Global loading
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSidebarCollapse: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  activeAlerts: [],
  addAlert: (alert) =>
    set((state) => ({
      activeAlerts: [alert, ...state.activeAlerts].slice(0, 20),
    })),
  removeAlert: (id) =>
    set((state) => ({
      activeAlerts: state.activeAlerts.filter((a) => a.id !== id),
    })),

  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
}));
