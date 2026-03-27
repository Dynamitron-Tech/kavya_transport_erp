import { create } from 'zustand';
import type { BankingEntry, BankBalanceSummary, CSVImportPreview, BankingEntryType } from '../types';

interface BankingFilters {
  account_id?: number;
  entry_type?: BankingEntryType;
  date_from?: string;
  date_to?: string;
  reconciled?: boolean;
  search?: string;
}

interface BankingState {
  // Filters
  filters: BankingFilters;
  setFilters: (filters: Partial<BankingFilters>) => void;
  resetFilters: () => void;

  // Active tab
  activeTab: 'overview' | 'transactions' | 'reconciliation' | 'accounts';
  setActiveTab: (tab: BankingState['activeTab']) => void;

  // Modal state
  showCreateEntry: boolean;
  setShowCreateEntry: (show: boolean) => void;
  editingEntry: BankingEntry | null;
  setEditingEntry: (entry: BankingEntry | null) => void;

  // CSV import
  showCSVImport: boolean;
  setShowCSVImport: (show: boolean) => void;
  csvPreview: CSVImportPreview | null;
  setCSVPreview: (preview: CSVImportPreview | null) => void;

  // Balance cache
  balanceSummary: BankBalanceSummary | null;
  setBalanceSummary: (summary: BankBalanceSummary | null) => void;
}

const defaultFilters: BankingFilters = {};

export const useBankingStore = create<BankingState>((set) => ({
  filters: defaultFilters,
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: defaultFilters }),

  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  showCreateEntry: false,
  setShowCreateEntry: (show) => set({ showCreateEntry: show }),
  editingEntry: null,
  setEditingEntry: (entry) => set({ editingEntry: entry }),

  showCSVImport: false,
  setShowCSVImport: (show) => set({ showCSVImport: show }),
  csvPreview: null,
  setCSVPreview: (preview) => set({ csvPreview: preview }),

  balanceSummary: null,
  setBalanceSummary: (summary) => set({ balanceSummary: summary }),
}));
