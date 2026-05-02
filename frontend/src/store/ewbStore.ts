import { create } from 'zustand';
import type { EwayBillStatus } from '../types';

interface EWBFilters {
  status?: EwayBillStatus;
  search?: string;
  trip_id?: number;
}

interface EWBState {
  // Filters
  filters: EWBFilters;
  setFilters: (filters: Partial<EWBFilters>) => void;
  resetFilters: () => void;

  // Active tab
  activeTab: 'all' | 'active' | 'expiring' | 'completed' | 'cancelled';
  setActiveTab: (tab: EWBState['activeTab']) => void;

  // Modals
  showCreateEWB: boolean;
  setShowCreateEWB: (show: boolean) => void;
  showExtendModal: boolean;
  setShowExtendModal: (show: boolean) => void;
  selectedEWBId: number | null;
  setSelectedEWBId: (id: number | null) => void;

  // Expiry alert visibility
  showExpiryAlerts: boolean;
  setShowExpiryAlerts: (show: boolean) => void;
  expiringCount: number;
  setExpiringCount: (count: number) => void;
}

export const useEWBStore = create<EWBState>((set) => ({
  filters: {},
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: {} }),

  activeTab: 'all',
  setActiveTab: (tab) => set({ activeTab: tab }),

  showCreateEWB: false,
  setShowCreateEWB: (show) => set({ showCreateEWB: show }),
  showExtendModal: false,
  setShowExtendModal: (show) => set({ showExtendModal: show }),
  selectedEWBId: null,
  setSelectedEWBId: (id) => set({ selectedEWBId: id }),

  showExpiryAlerts: true,
  setShowExpiryAlerts: (show) => set({ showExpiryAlerts: show }),
  expiringCount: 0,
  setExpiringCount: (count) => set({ expiringCount: count }),
}));
