import api from './api';
import type {
  Client, Vehicle, Driver, Job, LR, Trip, TripExpense,
  Invoice, Payment, LedgerEntry, Receivable, Payable,
  VehicleTracking, TripTrail, Alert, DashboardStats,
  Notification, ChartDataPoint, PaginatedResponse, FilterParams,
  Route, EwayBill, Document, DocumentStats
} from '@/types';

const unwrap = <T = any>(payload: any): T => (payload?.data ?? payload) as T;

// ---- Clients ----
export const clientService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<Client>> => {
    const data = await api.get('/clients', { params });
    return data;
  },
  get: async (id: number): Promise<Client> => {
    const data = await api.get(`/clients/${id}`);
    return unwrap(data);
  },
  create: async (payload: Partial<Client>): Promise<Client> => {
    const data = await api.post('/clients', payload);
    return data;
  },
  update: async (id: number, payload: Partial<Client>): Promise<Client> => {
    const data = await api.put(`/clients/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
  getJobs: async (id: number, params?: FilterParams) => {
    const data = await api.get(`/clients/${id}/jobs`, { params });
    return data;
  },
  getInvoices: async (id: number, params?: FilterParams) => {
    const data = await api.get(`/clients/${id}/invoices`, { params });
    return data;
  },
  getLedger: async (id: number, params?: FilterParams) => {
    const data = await api.get(`/clients/${id}/ledger`, { params });
    return data;
  },
  getOutstanding: async (id: number) => {
    const data = await api.get(`/clients/${id}/outstanding`);
    return data;
  },
};

// ---- Vehicles ----
export const vehicleService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<Vehicle>> => {
    const data = await api.get('/vehicles', { params });
    return data;
  },
  get: async (id: number): Promise<Vehicle> => {
    const data = await api.get(`/vehicles/${id}`);
    return unwrap(data);
  },
  create: async (payload: Partial<Vehicle>): Promise<Vehicle> => {
    const data = await api.post('/vehicles', payload);
    return data;
  },
  update: async (id: number, payload: Partial<Vehicle>): Promise<Vehicle> => {
    const data = await api.put(`/vehicles/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/vehicles/${id}`);
  },
  getOverview: async (id: number) => {
    const data = await api.get(`/vehicles/${id}/overview`);
    return data;
  },
  getTrips: async (id: number, params?: FilterParams) => {
    const data = await api.get(`/vehicles/${id}/trips`, { params });
    return data;
  },
  getMaintenance: async (id: number, params?: FilterParams) => {
    const data = await api.get(`/vehicles/${id}/maintenance`, { params });
    return data;
  },
  addMaintenance: async (id: number, payload: any) => {
    const data = await api.post(`/vehicles/${id}/maintenance`, payload);
    return data;
  },
  getDocuments: async (id: number) => {
    const data = await api.get(`/vehicles/${id}/documents`);
    return data;
  },
  getHealthScore: async (id: number) => {
    const data = await api.get(`/vehicles/${id}/health-score`);
    return data;
  },
};

// ---- Drivers ----
export const driverService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<Driver>> => {
    const data = await api.get('/drivers', { params });
    return data;
  },
  get: async (id: number): Promise<Driver> => {
    const data = await api.get(`/drivers/${id}`);
    return unwrap(data);
  },
  create: async (payload: Partial<Driver>): Promise<Driver> => {
    const data = await api.post('/drivers', payload);
    return data;
  },
  update: async (id: number, payload: Partial<Driver>): Promise<Driver> => {
    const data = await api.put(`/drivers/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/drivers/${id}`);
  },
  getAvailable: async () => {
    const data = await api.get('/drivers/available');
    return data;
  },
  getTrips: async (id: number, params?: FilterParams) => {
    const data = await api.get(`/drivers/${id}/trips`, { params });
    return data;
  },
  getAttendance: async (id: number, params?: FilterParams) => {
    const data = await api.get(`/drivers/${id}/attendance`, { params });
    return unwrap(data);
  },
  getPerformance: async (id: number) => {
    const data = await api.get(`/drivers/${id}/performance`);
    return unwrap(data);
  },
  getDashboard: async () => {
    const data = await api.get('/drivers/dashboard');
    return data.data ?? data;
  },
  getBehaviour: async (id: number, period?: string) => {
    const data = await api.get(`/drivers/${id}/behaviour`, { params: { period } });
    return unwrap(data);
  },
  getDocuments: async (id: number) => {
    const data = await api.get(`/drivers/${id}/documents`);
    return unwrap(data);
  },
  getAlerts: async (params?: { alert_type?: string; severity?: string }) => {
    const data = await api.get('/drivers/alerts/all', { params });
    return data;
  },
  assign: async (id: number, payload: { vehicle_id?: number; trip_id?: number }) => {
    const data = await api.post(`/drivers/${id}/assign`, payload);
    return data;
  },
  unassign: async (id: number) => {
    const data = await api.post(`/drivers/${id}/unassign`);
    return data;
  },
  updateStatus: async (id: number, status: string) => {
    const data = await api.post(`/drivers/${id}/status`, null, { params: { status } });
    return data;
  },
  markAttendance: async (id: number, payload: { status: string; remarks?: string }) => {
    const data = await api.post(`/drivers/${id}/attendance`, payload);
    return data;
  },
};

// ---- Jobs ----
export const jobService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<Job>> => {
    const data = await api.get('/jobs', { params });
    return data;
  },
  get: async (id: number): Promise<Job> => {
    const data = await api.get(`/jobs/${id}`);
    return unwrap(data);
  },
  create: async (payload: any): Promise<any> => {
    const data = await api.post('/jobs', payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<any> => {
    const data = await api.put(`/jobs/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/jobs/${id}`);
  },
  submitForApproval: async (id: number): Promise<any> => {
    const data = await api.post(`/jobs/${id}/submit-for-approval`);
    return data;
  },
  approve: async (id: number, payload: { action: string; remarks?: string }): Promise<any> => {
    const data = await api.post(`/jobs/${id}/approve`, payload);
    return data;
  },
  assign: async (id: number): Promise<any> => {
    const data = await api.put(`/jobs/${id}/assign`);
    return data;
  },
  assignVehicle: async (id: number, vehicleId: number): Promise<Job> => {
    const data = await api.post(`/jobs/${id}/assign-vehicle`, { vehicle_id: vehicleId });
    return data;
  },
  assignDriver: async (id: number, driverId: number): Promise<Job> => {
    const data = await api.post(`/jobs/${id}/assign-driver`, { driver_id: driverId });
    return data;
  },
  // Lookups
  getClients: async (search?: string): Promise<any> => {
    const data = await api.get('/jobs/lookup/clients', { params: { search } });
    return data;
  },
  getRoutes: async (search?: string): Promise<any> => {
    const data = await api.get('/jobs/lookup/routes', { params: { search } });
    return unwrap(data);
  },
  getVehicleTypes: async (): Promise<any> => {
    const data = await api.get('/jobs/lookup/vehicle-types');
    return unwrap(data);
  },
  getStates: async (): Promise<any> => {
    const data = await api.get('/jobs/lookup/states');
    return unwrap(data);
  },
  getNextJobNumber: async (): Promise<{ job_number: string }> => {
    const data = await api.get('/jobs/next-job-number');
    return unwrap(data);
  },
};

// ---- LR ----
export const lrService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<LR>> => {
    const data = await api.get('/lr', { params });
    return data;
  },
  get: async (id: number): Promise<LR> => {
    const data = await api.get(`/lr/${id}`);
    return unwrap(data);
  },
  create: async (payload: any): Promise<any> => {
    const data = await api.post('/lr', payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<any> => {
    const data = await api.put(`/lr/${id}`, payload);
    return data;
  },
  generate: async (id: number): Promise<any> => {
    const data = await api.post(`/lr/${id}/generate`);
    return data;
  },
  cancel: async (id: number): Promise<any> => {
    const data = await api.post(`/lr/${id}/cancel`);
    return data;
  },
  print: async (id: number) => {
    const data = await api.get(`/lr/${id}/print`);
    return data;
  },
  getStatusHistory: async (id: number) => {
    const data = await api.get(`/lr/${id}/status-history`);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/lr/${id}`);
  },
  // Lookups
  getJobs: async (search?: string): Promise<any> => {
    const data = await api.get('/lr/lookup/jobs', { params: { search } });
    return data;
  },
  getVehicles: async (search?: string): Promise<any> => {
    const data = await api.get('/lr/lookup/vehicles', { params: { search } });
    return data;
  },
  getDrivers: async (search?: string): Promise<any> => {
    const data = await api.get('/lr/lookup/drivers', { params: { search } });
    return data;
  },
  getPackageTypes: async (): Promise<any> => {
    const data = await api.get('/lr/lookup/package-types');
    return unwrap(data);
  },
  getQuantityUnits: async (): Promise<any> => {
    const data = await api.get('/lr/lookup/quantity-units');
    return unwrap(data);
  },
  getNextLRNumber: async (): Promise<{ lr_number: string }> => {
    const data = await api.get('/lr/next-lr-number');
    return unwrap(data);
  },
  uploadPOD: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const data = await api.post(`/lr/${id}/pod`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  verifyPOD: async (id: number) => {
    const data = await api.post(`/lr/${id}/pod/verify`);
    return data;
  },
};

// ---- E-way Bills ----
export const ewayBillService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<EwayBill>> => {
    const data = await api.get('/ewb', { params });
    return data;
  },
  get: async (id: number): Promise<EwayBill> => {
    const data = await api.get(`/eway-bills/${id}`);
    return unwrap(data);
  },
  create: async (payload: any): Promise<any> => {
    const data = await api.post('/eway-bills', payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<any> => {
    const data = await api.put(`/eway-bills/${id}`, payload);
    return data;
  },
  generate: async (id: number): Promise<any> => {
    const data = await api.post(`/eway-bills/${id}/generate`);
    return data;
  },
  cancel: async (id: number, payload: { reason: string }): Promise<any> => {
    const data = await api.post(`/eway-bills/${id}/cancel`, payload);
    return data;
  },
  extend: async (id: number, payload: { reason: string; remaining_distance_km?: number }): Promise<any> => {
    const data = await api.post(`/eway-bills/${id}/extend`, payload);
    return data;
  },
  print: async (id: number) => {
    const data = await api.get(`/eway-bills/${id}/print`);
    return data;
  },
  getStatusHistory: async (id: number) => {
    const data = await api.get(`/eway-bills/${id}/status-history`);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/eway-bills/${id}`);
  },
  // Lookups
  getJobs: async (search?: string): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/jobs', { params: { search } });
    return data;
  },
  getLRs: async (jobId?: number, search?: string): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/lrs', { params: { job_id: jobId, search } });
    return data;
  },
  getStates: async (): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/states');
    return data;
  },
  getHSNCodes: async (search?: string): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/hsn-codes', { params: { search } });
    return data;
  },
  getUQCCodes: async (): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/uqc-codes');
    return data;
  },
  getDocumentTypes: async (): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/document-types');
    return data;
  },
  getTransactionTypes: async (): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/transaction-types');
    return data;
  },
  getGSTRates: async (): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/gst-rates');
    return data;
  },
  getVehicles: async (search?: string): Promise<any> => {
    const data = await api.get('/eway-bills/lookup/vehicles', { params: { search } });
    return data;
  },
  getNextEwayNumber: async (): Promise<{ eway_bill_number: string }> => {
    const data = await api.get('/eway-bills/next-eway-number');
    return data;
  },
};

// ---- Trips ----
export const tripService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<Trip>> => {
    const data = await api.get('/trips', { params });
    return data;
  },
  get: async (id: number): Promise<Trip> => {
    const data = await api.get(`/trips/${id}`);
    return unwrap(data);
  },
  create: async (payload: Partial<Trip>): Promise<Trip> => {
    const data = await api.post('/trips', payload);
    return unwrap(data);
  },
  update: async (id: number, payload: Partial<Trip>): Promise<Trip> => {
    const data = await api.put(`/trips/${id}`, payload);
    return unwrap(data);
  },
  start: async (id: number, payload: { start_odometer: number }) => {
    const data = await api.put(`/trips/${id}/start`, payload);
    return data;
  },
  updateStatus: async (id: number, status: string) => {
    const data = await api.post(`/trips/${id}/status`, { status });
    return data;
  },
  complete: async (id: number, payload: { end_odometer: number; notes?: string }) => {
    const data = await api.post(`/trips/${id}/complete`, payload);
    return data;
  },
  close: async (id: number) => {
    const data = await api.put(`/trips/${id}/close`);
    return data;
  },
  reach: async (id: number) => {
    const data = await api.put(`/trips/${id}/reach`);
    return data;
  },
  // Expenses
  getExpenses: async (id: number): Promise<TripExpense[]> => {
    const data = await api.get(`/trips/${id}/expenses`);
    return data;
  },
  addExpense: async (id: number, payload: Partial<TripExpense>): Promise<TripExpense> => {
    const data = await api.post(`/trips/${id}/expenses`, payload);
    return data;
  },
  verifyExpense: async (tripId: number, expenseId: number) => {
    const data = await api.post(`/trips/${tripId}/expenses/${expenseId}/verify`);
    return data;
  },
  // Fuel
  addFuelEntry: async (id: number, payload: any) => {
    const data = await api.post(`/trips/${id}/fuel`, payload);
    return data;
  },
  // Tracking
  getTracking: async (id: number): Promise<TripTrail> => {
    const data = await api.get(`/trips/${id}/tracking`);
    return data;
  },
  getAlerts: async (id: number): Promise<Alert[]> => {
    const data = await api.get(`/trips/${id}/alerts`);
    return data;
  },
  // Lookups
  getNextTripNumber: async () => {
    const data = await api.get('/trips/next-trip-number');
    return unwrap(data);
  },
  getJobs: async (search?: string) => {
    const data = await api.get('/trips/lookup/jobs', { params: { search } });
    return data;
  },
  getVehicles: async (search?: string) => {
    const data = await api.get('/trips/lookup/vehicles', { params: { search } });
    return data;
  },
  getDrivers: async (search?: string) => {
    const data = await api.get('/trips/lookup/drivers', { params: { search } });
    return data;
  },
  getLRs: async (jobId?: number, search?: string) => {
    const data = await api.get('/trips/lookup/lrs', { params: { job_id: jobId, search } });
    return data;
  },
  getRoutes: async (search?: string) => {
    const data = await api.get('/trips/lookup/routes', { params: { search } });
    return unwrap(data);
  },
  getTripTypes: async () => {
    const data = await api.get('/trips/lookup/trip-types');
    return unwrap(data);
  },
  getPriorities: async () => {
    const data = await api.get('/trips/lookup/priorities');
    return unwrap(data);
  },
  getPaymentModes: async () => {
    const data = await api.get('/trips/lookup/payment-modes');
    return unwrap(data);
  },
  getExpenseCategories: async () => {
    const data = await api.get('/trips/lookup/expense-categories');
    return data;
  },
  getDocumentTypes: async () => {
    const data = await api.get('/trips/lookup/document-types');
    return data;
  },
  dispatch: async (id: number) => {
    const data = await api.post(`/trips/${id}/dispatch`);
    return data;
  },
};

// ---- Finance ----
export const financeService = {
  // Invoices
  listInvoices: async (params?: FilterParams): Promise<PaginatedResponse<Invoice>> => {
    const data = await api.get('/invoices', { params });
    return data;
  },
  getInvoice: async (id: number): Promise<Invoice> => {
    const data = await api.get(`/finance/invoices/${id}`);
    return data;
  },
  createInvoice: async (payload: Partial<Invoice>): Promise<Invoice> => {
    const data = await api.post('/finance/invoices', payload);
    return data;
  },
  updateInvoice: async (id: number, payload: Partial<Invoice>): Promise<Invoice> => {
    const data = await api.put(`/finance/invoices/${id}`, payload);
    return data;
  },
  generateInvoicePDF: async (id: number) => {
    const data = await api.get(`/finance/invoices/${id}/pdf`, { responseType: 'blob' });
    return data;
  },
  sendInvoice: async (id: number) => {
    const data = await api.post(`/finance/invoices/${id}/send`);
    return data;
  },

  // Payments
  listPayments: async (params?: FilterParams): Promise<PaginatedResponse<Payment>> => {
    const data = await api.get('/finance/payments', { params });
    return data;
  },
  createPayment: async (payload: Partial<Payment>): Promise<Payment> => {
    const data = await api.post('/finance/payments', payload);
    return data;
  },

  // Ledger
  getLedger: async (params?: FilterParams): Promise<LedgerEntry[]> => {
    const data = await api.get('/ledger', { params });
    return Array.isArray(data) ? data : (data?.items ?? []);
  },

  // GST
  getGSTSummary: async (params?: { from_date: string; to_date: string }) => {
    const data = await api.get('/finance/gst/summary', { params });
    return data;
  },
  getGSTR1: async (params?: { month: number; year: number }) => {
    const data = await api.get('/finance/gst/gstr1', { params });
    return data;
  },
  getGSTR3B: async (params?: { month: number; year: number }) => {
    const data = await api.get('/finance/gst/gstr3b', { params });
    return data;
  },

  // Receivables / Payables
  getReceivables: async (params?: FilterParams): Promise<Receivable[]> => {
    const data = await api.get('/finance/receivables', { params });
    return unwrap(data);
  },
  getPayables: async (params?: FilterParams): Promise<Payable[]> => {
    const data = await api.get('/finance/payables', { params });
    return unwrap(data);
  },
  getProfitLoss: async (params?: { from_date: string; to_date: string }) => {
    const data = await api.get('/finance/profit-loss', { params });
    return data;
  },

  // Banking Entries
  listBankingEntries: async (params?: FilterParams) => {
    const data = await api.get('/finance/banking/entries', { params });
    return unwrap(data);
  },
  createBankingEntry: async (payload: any) => {
    const data = await api.post('/finance/banking/entries', payload);
    return data;
  },
  getBankingEntry: async (id: number) => {
    const data = await api.get(`/finance/banking/entries/${id}`);
    return data;
  },
  getBankAccounts: async () => {
    const data = await api.get('/finance/banking/accounts');
    return unwrap(data);
  },
  getNextBankingEntryNumber: async () => {
    const data = await api.get('/finance/banking/next-entry-number');
    return unwrap(data);
  },
};

// ---- Tracking ----
export const trackingService = {
  getLiveVehicles: async (): Promise<VehicleTracking[]> => {
    const data = await api.get('/tracking/live');
    return unwrap(data);
  },
  getVehicleTracking: async (vehicleId: number): Promise<VehicleTracking> => {
    const data = await api.get(`/tracking/vehicle/${vehicleId}`);
    return unwrap(data);
  },
  getTripTrail: async (tripId: number): Promise<TripTrail> => {
    const data = await api.get(`/tracking/trip/${tripId}/trail`);
    return data;
  },
  getAlerts: async (params?: FilterParams): Promise<Alert[]> => {
    const data = await api.get('/tracking/alerts', { params });
    return unwrap(data);
  },
  acknowledgeAlert: async (id: string) => {
    const data = await api.post(`/tracking/alerts/${id}/acknowledge`);
    return data;
  },
};

// ---- Reports ----
const buildReportParams = (params?: FilterParams) => {
  const reportParams: any = { ...(params || {}) };
  const from = (reportParams as any).from;
  const to = (reportParams as any).to;

  if (!from) {
    delete (reportParams as any).from;
  }
  if (!to) {
    delete (reportParams as any).to;
  }

  return Object.keys(reportParams).length ? reportParams : undefined;
};

export const reportService = {
  dashboard: async () => {
    const data = await api.get('/reports/dashboard');
    return unwrap(data);
  },
  tripSummary: async (params?: FilterParams) => {
    const data = await api.get('/reports/trip-summary', { params: buildReportParams(params) });
    return data;
  },
  vehiclePerformance: async (params?: FilterParams) => {
    const data = await api.get('/reports/vehicle-performance', { params: buildReportParams(params) });
    return data;
  },
  driverPerformance: async (params?: FilterParams) => {
    const data = await api.get('/reports/driver-performance', { params: buildReportParams(params) });
    return data;
  },
  fuelAnalysis: async (params?: FilterParams) => {
    const data = await api.get('/reports/fuel-analysis', { params: buildReportParams(params) });
    return data;
  },
  revenueAnalysis: async (params?: FilterParams) => {
    const data = await api.get('/reports/revenue-analysis', { params: buildReportParams(params) });
    return data;
  },
  expenseAnalysis: async (params?: FilterParams) => {
    const data = await api.get('/reports/expense-analysis', { params: buildReportParams(params) });
    return data;
  },
  routeAnalysis: async (params?: FilterParams) => {
    const data = await api.get('/reports/route-analysis', { params: buildReportParams(params) });
    return data;
  },
  clientOutstanding: async (params?: FilterParams) => {
    const data = await api.get('/reports/client-outstanding', { params: buildReportParams(params) });
    return data;
  },
  exportReport: async (reportType: string, format: string, params?: FilterParams) => {
    const data = await api.get(`/reports/export/${reportType}`, {
      params: { format, ...params },
      responseType: 'blob',
    });
    return data;
  },
};

// ---- Dashboard ----
// Note: Backend returns { success, data, message } wrapper
export const dashboardService = {
  getOverview: async (): Promise<DashboardStats> => {
    const data = await api.get('/dashboard/overview');
    return data.data ?? data;
  },
  getFleetStats: async () => {
    const data = await api.get('/dashboard/fleet-stats');
    return data.data ?? data;
  },
  getTripStats: async () => {
    const data = await api.get('/dashboard/trip-stats');
    return data.data ?? data;
  },
  getFinanceStats: async () => {
    const data = await api.get('/dashboard/finance-stats');
    return data.data ?? data;
  },
  getRevenueTrend: async (params?: { period?: string }): Promise<ChartDataPoint[]> => {
    const data = await api.get('/dashboard/charts/revenue-trend', { params });
    return data.data ?? data;
  },
  getExpenseBreakdown: async (): Promise<ChartDataPoint[]> => {
    const data = await api.get('/dashboard/charts/expense-breakdown');
    return data.data ?? data;
  },
  getFleetUtilization: async (): Promise<ChartDataPoint[]> => {
    const data = await api.get('/dashboard/charts/fleet-utilization');
    return data.data ?? data;
  },
  getNotifications: async (): Promise<Notification[]> => {
    const data = await api.get('/dashboard/notifications');
    const items = data.data ?? data;
    return Array.isArray(items) ? items : (items?.alerts ?? []);
  },
  markNotificationRead: async (id: string) => {
    await api.post(`/dashboard/notifications/${id}/read`);
  },

  // Project Associate Dashboard
  getPAKpis: async (params?: { date_filter?: string; from_date?: string; to_date?: string }) => {
    const data = await api.get('/dashboard/pa/kpis', { params });
    return data.data ?? data;
  },
  getPAActionCenter: async () => {
    const data = await api.get('/dashboard/pa/action-center');
    return data.data ?? data;
  },
  getPAJobPipeline: async () => {
    const data = await api.get('/dashboard/pa/job-pipeline');
    return data.data ?? data;
  },
  getPARecentActivity: async (limit?: number) => {
    const data = await api.get('/dashboard/pa/recent-activity', { params: { limit } });
    return data.data ?? data;
  },
  getPABankingStatus: async () => {
    const data = await api.get('/dashboard/pa/banking-status');
    return data.data ?? data;
  },

  // PA-specific: Fleet, Compliance, Trip Workflow, Alerts, Revenue
  getPAFleetStatus: async () => {
    const data = await api.get('/dashboard/pa/fleet-status');
    return data.data ?? data;
  },
  getPAComplianceAlerts: async () => {
    const data = await api.get('/dashboard/pa/compliance-alerts');
    return data.data ?? data;
  },
  getPATripWorkflow: async () => {
    const data = await api.get('/dashboard/pa/trip-workflow');
    return data.data ?? data;
  },
  getPASystemAlerts: async () => {
    const data = await api.get('/dashboard/pa/system-alerts');
    return data.data ?? data;
  },
  getPARevenueSnapshot: async (params?: { period?: string }) => {
    const data = await api.get('/dashboard/pa/revenue-snapshot', { params });
    return data.data ?? data;
  },
};

// ---- Documents ----
export const documentService = {
  list: async (params?: FilterParams): Promise<PaginatedResponse<Document>> => {
    const data = await api.get('/documents', { params });
    return data;
  },
  get: async (id: number): Promise<Document> => {
    const data = await api.get(`/documents/${id}`);
    return unwrap(data);
  },
  create: async (payload: Partial<Document>): Promise<Document> => {
    const data = await api.post('/documents', payload);
    return data;
  },
  update: async (id: number, payload: Partial<Document>): Promise<Document> => {
    const data = await api.put(`/documents/${id}`, payload);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },
  submit: async (id: number): Promise<Document> => {
    const data = await api.post(`/documents/${id}/submit`);
    return data;
  },
  approve: async (id: number): Promise<Document> => {
    const data = await api.post(`/documents/${id}/approve`);
    return data;
  },
  reject: async (id: number, reason: string): Promise<Document> => {
    const data = await api.post(`/documents/${id}/reject`, null, { params: { reason } });
    return data;
  },
  stats: async (): Promise<DocumentStats> => {
    const data = await api.get('/documents/stats');
    return unwrap(data);
  },
  getNextDocNumber: async (): Promise<string> => {
    const data = await api.get('/documents/next-doc-number');
    return unwrap<{ doc_number: string }>(data).doc_number;
  },
  lookupDocumentTypes: async () => {
    const data = await api.get('/documents/lookup/document-types');
    return unwrap<{ items: any[] }>(data).items;
  },
  lookupEntityTypes: async () => {
    const data = await api.get('/documents/lookup/entity-types');
    return unwrap<{ items: any[] }>(data).items;
  },
  lookupEntities: async (entityType: string, search?: string) => {
    const data = await api.get('/documents/lookup/entities', { params: { entity_type: entityType, search } });
    return data.items;
  },
  lookupComplianceCategories: async () => {
    const data = await api.get('/documents/lookup/compliance-categories');
    return unwrap<{ items: any[] }>(data).items;
  },
  lookupReminderOptions: async () => {
    const data = await api.get('/documents/lookup/reminder-options');
    return unwrap<{ items: any[] }>(data).items;
  },
  lookupApprovalStatuses: async () => {
    const data = await api.get('/documents/lookup/approval-statuses');
    return data.items;
  },
  lookupReviewers: async () => {
    const data = await api.get('/documents/lookup/reviewers');
    return unwrap<{ items: any[] }>(data).items;
  },
};

// ---- Routes ----
export const routeService = {
  list: async (params?: FilterParams): Promise<Route[]> => {
    const data = await api.get('/routes', { params });
    return unwrap(data);
  },
  get: async (id: number): Promise<Route> => {
    const data = await api.get(`/routes/${id}`);
    return unwrap(data);
  },
  create: async (payload: Partial<Route>): Promise<Route> => {
    const data = await api.post('/routes', payload);
    return data;
  },
  update: async (id: number, payload: Partial<Route>): Promise<Route> => {
    const data = await api.put(`/routes/${id}`, payload);
    return data;
  },
};

// ---- Fleet Manager ----
export const fleetService = {
  // Dashboard
  getDashboardKPIs: async () => {
    const data = await api.get('/fleet/dashboard/kpis');
    return unwrap(data);
  },
  getFleetUtilizationChart: async (period = 'monthly') => {
    const data = await api.get('/fleet/dashboard/charts/fleet-utilization', { params: { period } });
    return unwrap(data);
  },
  getFuelConsumptionChart: async (period = 'monthly') => {
    const data = await api.get('/fleet/dashboard/charts/fuel-consumption', { params: { period } });
    return unwrap(data);
  },
  getMaintenanceCostChart: async (period = 'monthly') => {
    const data = await api.get('/fleet/dashboard/charts/maintenance-cost', { params: { period } });
    return unwrap(data);
  },
  getTripEfficiencyChart: async (period = 'monthly') => {
    const data = await api.get('/fleet/dashboard/charts/trip-efficiency', { params: { period } });
    return unwrap(data);
  },
  getRecentAlerts: async (limit = 10) => {
    const data = await api.get('/fleet/dashboard/recent-alerts', { params: { limit } });
    return unwrap(data);
  },
  getExpiringDocuments: async (days = 30) => {
    const data = await api.get('/fleet/dashboard/expiring-documents', { params: { days } });
    return unwrap(data);
  },
  getUpcomingMaintenance: async () => {
    const data = await api.get('/fleet/dashboard/upcoming-maintenance');
    return unwrap(data);
  },
  getActiveTrips: async () => {
    const data = await api.get('/fleet/dashboard/active-trips');
    return unwrap(data);
  },

  // Fleet Vehicles
  getVehicles: async (params?: any) => {
    const data = await api.get('/vehicles', { params });
    return data;
  },
  getVehicleProfile: async (vehicleId: number) => {
    const data = await api.get(`/fleet/vehicles/${vehicleId}/profile`);
    return data;
  },

  // Fleet Drivers
  getDrivers: async (params?: any) => {
    const data = await api.get('/fleet/drivers', { params });
    return unwrap(data);
  },
  getDriverProfile: async (driverId: number) => {
    const data = await api.get(`/fleet/drivers/${driverId}/profile`);
    return data;
  },

  // Live Tracking
  getLiveTracking: async () => {
    const data = await api.get('/fleet/tracking/live');
    return unwrap(data);
  },

  // Maintenance
  getMaintenanceSchedule: async (params?: any) => {
    const data = await api.get('/service', { params });
    return unwrap(data);
  },
  getWorkOrders: async (params?: any) => {
    const data = await api.get('/fleet/maintenance/work-orders', { params });
    return data;
  },
  getPartsInventory: async () => {
    const data = await api.get('/fleet/maintenance/parts-inventory');
    return data;
  },
  getTyreManagement: async () => {
    const data = await api.get('/tyre');
    return data;
  },
  getBatteryMonitoring: async () => {
    const data = await api.get('/fleet/maintenance/battery');
    return data;
  },

  // Fuel
  getFuelRecords: async (params?: any) => {
    const data = await api.get('/fuel', { params });
    return unwrap(data);
  },
  getFuelSummary: async (period = 'this_month') => {
    const data = await api.get('/fleet/fuel/summary', { params: { period } });
    return unwrap(data);
  },

  // Alerts
  getAlerts: async (params?: any) => {
    const data = await api.get('/dashboard/notifications');
    const items = (unwrap(data) || []).map((a: any) => {
      const mappedType = a.type === 'warning' ? 'document_expiry' : (a.type || 'system');
      const severity = params?.severity || (a.type === 'warning' ? 'warning' : 'info');
      return {
        id: String(a.id),
        type: mappedType,
        severity,
        title: a.title || 'Alert',
        message: a.message || '',
        vehicle: a.vehicle || '',
        driver: a.driver || '',
        location: a.location || '',
        created_at: a.timestamp || new Date().toISOString(),
        acknowledged: !!a.read,
      };
    }).filter((item: any) => {
      if (params?.alert_type && item.type !== params.alert_type) return false;
      if (params?.severity && item.severity !== params.severity) return false;
      return true;
    });

    const summary = {
      critical: items.filter((i: any) => i.severity === 'critical').length,
      warning: items.filter((i: any) => i.severity === 'warning').length,
      info: items.filter((i: any) => i.severity === 'info').length,
    };

    return { items, summary, total: items.length };
  },
  acknowledgeAlert: async (alertId: string) => {
    const data = await api.post(`/dashboard/notifications/${alertId}/read`);
    return unwrap(data);
  },

  // Reports
  getFleetUtilizationReport: async (params?: any) => {
    const data = await api.get('/fleet/reports/fleet-utilization', { params });
    return unwrap(data);
  },
  getVehicleProfitabilityReport: async (params?: any) => {
    const data = await api.get('/fleet/reports/vehicle-profitability', { params });
    return unwrap(data);
  },
  getDriverPerformanceReport: async (params?: any) => {
    const data = await api.get('/fleet/reports/driver-performance', { params });
    return unwrap(data);
  },
  getMaintenanceCostReport: async (params?: any) => {
    const data = await api.get('/fleet/reports/maintenance-cost', { params });
    return unwrap(data);
  },
  getFuelConsumptionReport: async (params?: any) => {
    const data = await api.get('/fleet/reports/fuel-consumption', { params });
    return unwrap(data);
  },
  getTripPerformanceReport: async (params?: any) => {
    const data = await api.get('/fleet/reports/trip-performance', { params });
    return unwrap(data);
  },
  exportReport: async (reportType: string, format = 'csv', params?: any) => {
    const data = await api.get(`/reports/export/${reportType}`, { params: { format, ...params }, responseType: 'blob' });
    return data;
  },
};

// ---- Accountant ----
export const accountantService = {
  // Dashboard
  getDashboardKPIs: async (period = 'this_month') => {
    const data = await api.get('/accountant/dashboard/kpis', { params: { period } });
    return unwrap(data);
  },
  getRevenueTrend: async (period = '6_months') => {
    const data = await api.get('/accountant/dashboard/revenue-trend', { params: { period } });
    return unwrap(data);
  },
  getExpenseBreakdown: async (period = 'this_month') => {
    const data = await api.get('/accountant/dashboard/expense-breakdown', { params: { period } });
    return unwrap(data);
  },
  getCashFlow: async (period = '6_months') => {
    const data = await api.get('/accountant/dashboard/cash-flow', { params: { period } });
    return unwrap(data);
  },
  getReceivablesAging: async () => {
    const data = await api.get('/accountant/dashboard/receivables-aging');
    return data;
  },
  getRecentTransactions: async (limit = 10) => {
    const data = await api.get('/accountant/dashboard/recent-transactions', { params: { limit } });
    return unwrap(data);
  },
  getPendingActions: async () => {
    const data = await api.get('/accountant/dashboard/pending-actions');
    return unwrap(data);
  },

  // Invoices
  listInvoices: async (params?: any) => {
    const data = await api.get('/accountant/invoices', { params });
    return data;
  },
  getInvoiceDetail: async (id: number) => {
    const data = await api.get(`/accountant/invoices/${id}`);
    return data;
  },
  createInvoice: async (payload: any) => {
    const data = await api.post('/accountant/invoices', payload);
    return data;
  },
  updateInvoice: async (id: number, payload: any) => {
    const data = await api.put(`/accountant/invoices/${id}`, payload);
    return data;
  },
  sendInvoice: async (id: number) => {
    const data = await api.post(`/accountant/invoices/${id}/send`);
    return data;
  },
  downloadInvoicePdf: async (id: number) => {
    const data = await api.get(`/accountant/invoices/${id}/pdf`);
    return data;
  },
  getUnbilledTrips: async () => {
    const data = await api.get('/accountant/invoices/unbilled-trips');
    return data;
  },

  // Receivables
  getReceivables: async (params?: any) => {
    const data = await api.get('/accountant/receivables', { params });
    return data;
  },
  sendPaymentReminder: async (clientId: number) => {
    const data = await api.post(`/accountant/receivables/${clientId}/send-reminder`);
    return data;
  },

  // Payables
  getPayables: async (params?: any) => {
    const data = await api.get('/accountant/payables', { params });
    return unwrap(data);
  },
  recordPayablePayment: async (payableId: number, payload: any) => {
    const data = await api.post(`/accountant/payables/${payableId}/pay`, payload);
    return data;
  },

  // Expenses
  listExpenses: async (params?: any) => {
    const data = await api.get('/accountant/expenses', { params });
    return data;
  },
  createExpense: async (payload: any) => {
    const data = await api.post('/accountant/expenses', payload);
    return data;
  },
  approveExpense: async (id: number) => {
    const data = await api.put(`/accountant/expenses/${id}/approve`);
    return data;
  },
  rejectExpense: async (id: number, _reason?: string) => {
    const data = await api.put(`/accountant/expenses/${id}/reject`);
    return data;
  },

  // Fuel Expenses
  listFuelExpenses: async (params?: any) => {
    const data = await api.get('/accountant/fuel-expenses', { params });
    return unwrap(data);
  },
  createFuelExpense: async (payload: any) => {
    const data = await api.post('/accountant/fuel-expenses', payload);
    return data;
  },
  getFuelExpenseSummary: async (period = 'this_month') => {
    const data = await api.get('/accountant/fuel-expenses/summary', { params: { period } });
    return unwrap(data);
  },

  // Banking
  getBankingOverview: async () => {
    const data = await api.get('/accountant/banking/overview');
    return unwrap(data);
  },
  listBankTransactions: async (params?: any) => {
    const data = await api.get('/accountant/banking/transactions', { params });
    return unwrap(data);
  },
  recordDeposit: async (payload: any) => {
    const data = await api.post('/accountant/banking/deposit', payload);
    return data;
  },
  recordWithdrawal: async (payload: any) => {
    const data = await api.post('/accountant/banking/withdrawal', payload);
    return data;
  },
  recordTransfer: async (payload: any) => {
    const data = await api.post('/accountant/banking/transfer', payload);
    return data;
  },

  // Ledger
  getLedgerAccounts: async (params?: any) => {
    const data = await api.get('/accountant/ledger/accounts', { params });
    return unwrap(data);
  },
  getLedgerAccountEntries: async (accountId: number, params?: any) => {
    const data = await api.get(`/accountant/ledger/accounts/${accountId}/entries`, { params });
    return data;
  },

  // Reports
  getProfitLossReport: async (params?: any) => {
    const data = await api.get('/accountant/reports/profit-loss', { params });
    return data;
  },
  getExpenseReport: async (params?: any) => {
    const data = await api.get('/accountant/reports/expense-report', { params });
    return data;
  },
  getRevenueReport: async (params?: any) => {
    const data = await api.get('/accountant/reports/revenue-report', { params });
    return data;
  },
  getTripProfitabilityReport: async (params?: any) => {
    const data = await api.get('/accountant/reports/trip-profitability', { params });
    return data;
  },
  getClientOutstandingReport: async () => {
    const data = await api.get('/accountant/reports/client-outstanding');
    return data;
  },
  getVendorPayablesReport: async () => {
    const data = await api.get('/accountant/reports/vendor-payables');
    return data;
  },
  getFuelCostReport: async (params?: any) => {
    const data = await api.get('/accountant/reports/fuel-cost', { params });
    return data;
  },
  getMonthlySummaryReport: async (params?: any) => {
    const data = await api.get('/accountant/reports/monthly-summary', { params });
    return data;
  },
  exportReport: async (reportType: string, format = 'csv', params?: any) => {
    const data = await api.get(`/reports/export/${reportType}`, { params: { format, ...params }, responseType: 'blob' });
    return data;
  },
};


// ---- VAHAN (Vehicle Compliance) ----
export const vahanService = {
  lookupRC: async (regNumber: string) => {
    const data = await api.get(`/vahan/rc/${regNumber}`);
    return unwrap(data);
  },
  checkInsurance: async (regNumber: string) => {
    const data = await api.get(`/vahan/insurance/${regNumber}`);
    return unwrap(data);
  },
  checkFitness: async (regNumber: string) => {
    const data = await api.get(`/vahan/fitness/${regNumber}`);
    return unwrap(data);
  },
  checkPermit: async (regNumber: string) => {
    const data = await api.get(`/vahan/permit/${regNumber}`);
    return unwrap(data);
  },
  checkPUC: async (regNumber: string) => {
    const data = await api.get(`/vahan/puc/${regNumber}`);
    return unwrap(data);
  },
  fullCheck: async (regNumber: string) => {
    const data = await api.get(`/vahan/full-check/${regNumber}`);
    return unwrap(data);
  },
};

// ---- Sarathi (DL Verification) ----
export const sarathiService = {
  verifyDL: async (dlNumber: string, dob: string) => {
    const data = await api.get(`/sarathi/verify/${dlNumber}`, { params: { dob } });
    return unwrap(data);
  },
  getDLDetails: async (dlNumber: string) => {
    const data = await api.get(`/sarathi/details/${dlNumber}`);
    return unwrap(data);
  },
};

// ---- eChallan ----
export const echallanService = {
  getByVehicle: async (regNumber: string) => {
    const data = await api.get(`/echallan/vehicle/${regNumber}`);
    return unwrap(data);
  },
  getByDriver: async (dlNumber: string) => {
    const data = await api.get(`/echallan/driver/${dlNumber}`);
    return unwrap(data);
  },
  getStatus: async (challanNumber: string) => {
    const data = await api.get(`/echallan/status/${challanNumber}`);
    return unwrap(data);
  },
};

// ---- GST Verification ----
export const gstService = {
  verifyGSTIN: async (gstin: string) => {
    const data = await api.get(`/gst/verify/${gstin}`);
    return unwrap(data);
  },
};

// ---- Maps ----
export const mapsService = {
  getRouteDistance: async (origin: { lat: number; lng: number }, dest: { lat: number; lng: number }) => {
    const data = await api.get('/maps/route', {
      params: { origin_lat: origin.lat, origin_lng: origin.lng, dest_lat: dest.lat, dest_lng: dest.lng },
    });
    return unwrap(data);
  },
  geocode: async (address: string) => {
    const data = await api.get('/maps/geocode', { params: { address } });
    return unwrap(data);
  },
  reverseGeocode: async (lat: number, lng: number) => {
    const data = await api.get('/maps/reverse-geocode', { params: { lat, lng } });
    return unwrap(data);
  },
};

// ---- GPS Tracking ----
export const gpsTrackingService = {
  getLivePositions: async () => {
    const data = await api.get('/tracking/gps/positions');
    return unwrap(data);
  },
  getVehiclePath: async (vehicleId: string, hours = 24) => {
    const data = await api.get(`/tracking/gps/path/${vehicleId}`, { params: { hours } });
    return unwrap(data);
  },
};

// ---- Payments (Razorpay) ----
export const paymentGatewayService = {
  createLink: async (payload: { amount: number; description: string; customer_name: string; customer_phone: string; customer_email?: string; reference_id?: string }) => {
    const data = await api.post('/payments/create-link', payload);
    return unwrap(data);
  },
  verify: async (payload: { payment_id: string; payment_link_id: string; signature: string }) => {
    const data = await api.post('/payments/verify', payload);
    return unwrap(data);
  },
  getStatus: async (paymentId: string) => {
    const data = await api.get(`/payments/status/${paymentId}`);
    return unwrap(data);
  },
};

// ---- Notifications ----
export const notificationService = {
  sendPush: async (payload: { device_token: string; title: string; body: string; data?: Record<string, any> }) => {
    const data = await api.post('/notifications/push', payload);
    return unwrap(data);
  },
  sendSMS: async (phone: string, message: string) => {
    const data = await api.post('/notifications/sms', { phone, message });
    return unwrap(data);
  },
  sendWhatsApp: async (phone: string, message: string) => {
    const data = await api.post('/notifications/whatsapp', { phone, message });
    return unwrap(data);
  },
};

// ---- Fuel Prices ----
export const fuelPriceService = {
  getPrice: async (city = 'coimbatore') => {
    const data = await api.get('/fuel-prices', { params: { city } });
    return unwrap(data);
  },
  getBulkPrices: async () => {
    const data = await api.get('/fuel-prices/bulk');
    return unwrap(data);
  },
};
