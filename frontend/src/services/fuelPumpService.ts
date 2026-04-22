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

  // Pump operator management (admin/fleet-manager)
  getPumpOperators: () => api.get('/users/pump-operators'),
  getPumpOperatorAttendance: (userId: number, month: string) =>
    api.get(`/users/${userId}/attendance`, { params: { month } }),
  getPumpOperatorFuelIssues: (userId: number, date: string) =>
    api.get('/fuel-pump/issues', { params: { issued_by: userId, date_from: date, date_to: date, limit: 200 } }),

  // Bunk / branch management
  getBranches: () => api.get('/fuel-pump/branches'),
  createBranch: (data: any) => api.post('/fuel-pump/branches', data),
  getTanksByBranch: (branchId: number) => api.get('/fuel-pump/tanks', { params: { branch_id: branchId } }),
  getPumps: (branchId?: number, tankId?: number) =>
    api.get('/fuel-pump/pumps', { params: { branch_id: branchId, tank_id: tankId } }),
  createPump: (data: any) => api.post('/fuel-pump/pumps', data),
  getIssuesByDateRange: (dateFrom: string, dateTo: string, branchId?: number) =>
    api.get('/fuel-pump/issues', { params: { date_from: dateFrom, date_to: dateTo, branch_id: branchId, limit: 500 } }),
  getStockByBranch: (branchId?: number) =>
    api.get('/fuel-pump/stock', { params: { branch_id: branchId, limit: 200 } }),
};
