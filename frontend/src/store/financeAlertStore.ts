import { create } from 'zustand';

interface FinanceAlertState {
  alertCount: number;
  setAlertCount: (n: number) => void;
}

export const useFinanceAlertStore = create<FinanceAlertState>((set) => ({
  alertCount: 0,
  setAlertCount: (n) => set({ alertCount: n }),
}));
