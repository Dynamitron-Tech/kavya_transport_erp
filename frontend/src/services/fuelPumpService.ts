import api from './api';

export const fuelPumpService = {
  // Dashboard
  getDashboard: () => api.get('/fuel-pump/dashboard'),

  // Tanks
  getTanks: () => api.get('/fuel-pump/tanks'),
  getTank: (id: number) => api.get(`/fuel-pump/tanks/${id}`),
  createTank: (data: any) => api.post('/fuel-pump/tanks', data),
  updateTank: (id: number, data: any) => api.put(`/fuel-pump/tanks/${id}`, data),
  deleteTank: (id: number) => api.delete(`/fuel-pump/tanks/${id}`),

  // Fuel Issues
  issueFuel: (data: any) => api.post('/fuel-pump/issues', data),
  getIssues: (params?: Record<string, any>) => api.get('/fuel-pump/issues', { params }),
  getIssue: (id: number) => api.get(`/fuel-pump/issues/${id}`),

  // Stock Transactions
  addStock: (data: any) => api.post('/fuel-pump/stock', data),
  getStockTransactions: (params?: Record<string, any>) => api.get('/fuel-pump/stock', { params }),

  // Theft Alerts
  getAlerts: (params?: Record<string, any>) => api.get('/fuel-pump/alerts', { params }),
  resolveAlert: (id: number, data: any) => api.put(`/fuel-pump/alerts/${id}`, data),

  // Cross-Verification
  getVerification: (days?: number) => api.get('/fuel-pump/verification', { params: days ? { days } : {} }),
};
