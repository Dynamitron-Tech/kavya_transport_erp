import api from './api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FinanceDashboardSummary {
  expenses: { pending_count: number; pending_amount_paise: number };
  salary: { total_staff: number; paid_count: number; paid_paise: number };
  payables: { overdue_count: number; due_this_week_count: number; due_this_week_paise: number };
  razorpay_balance_paise: number;
  month: string;
}

export interface SalaryStaffItem {
  employee_id: number;
  name: string;
  designation: string;
  bank_last4: string | null;
  bank_name: string | null;
  salary_paise: number;
  status: string;
  payout_id: number | null;
  utr: string | null;
  paid_at: string | null;
  has_bank_account: boolean;
}

export interface SalarySummary {
  month: string;
  staff: SalaryStaffItem[];
  total_due_paise: number;
  paid_count: number;
  unpaid_count: number;
  paid_paise: number;
  remaining_paise: number;
}

export interface ExpenseSubmission {
  id: number;
  submitted_by: number;
  submitter_name: string;
  driver_name: string | null;
  driver_id: number | null;
  category: string;
  amount_paise: number;
  payment_method: string;
  upi_ref_number: string | null;
  receipt_image_s3: string | null;
  receipt_url: string | null;
  description: string | null;
  status: string;
  trip_id: number | null;
  vehicle_id: number | null;
  submitted_at: string | null;
  created_at: string | null;
  rejection_reason: string | null;
}

export interface PaymentScheduleItem {
  id: number;
  schedule_type: string;
  payment_type: string;
  label: string;
  description: string | null;
  payee_name: string | null;
  vendor_name: string | null;
  amount_paise: number;
  frequency: string;
  next_due_date: string | null;
  days_until_due: number | null;
  urgency: string;
  vehicle_id: number | null;
  last_paid_at: string | null;
}

export interface PayoutItem {
  id: number;
  payout_type: string;
  recipient_name: string | null;
  amount_paise: number;
  payment_method: string | null;
  status: string;
  utr: string | null;
  narration: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string | null;
  processed_at: string | null;
  failure_reason: string | null;
  razorpay_payout_id: string | null;
}

export interface PaymentContactItem {
  id: number;
  contact_type: string;
  entity_id: number;
  entity_name: string;
  bank_name: string | null;
  bank_last4: string | null;
  ifsc: string | null;
  upi_id: string | null;
  is_verified: boolean;
  preferred_method: string;
  razorpay_contact_id: string | null;
  razorpay_fund_account_id: string | null;
}

// ─── API calls ─────────────────────────────────────────────────────────────────

const BASE = '/finance-manager';

export const financeManagerService = {
  // Dashboard
  getDashboardSummary: () => api.get<{ data: FinanceDashboardSummary }>(`${BASE}/dashboard/summary`).then(r => r.data),

  // Salary
  getSalarySummary: (month?: string) => api.get<{ data: SalarySummary }>(`${BASE}/salary-summary`, { params: { month } }).then(r => r.data),
  paySalary: (employee_id: number, month: string, amount_paise: number) =>
    api.post(`${BASE}/payments/salary`, { employee_id, month, amount_paise }),
  paySalaryBulk: (payments: { employee_id: number; amount_paise: number }[], month: string) =>
    api.post(`${BASE}/payments/salary/bulk`, { payments, month }),

  // Advances
  issueAdvance: (driver_id: number, trip_id?: number, amount_paise?: number) =>
    api.post(`${BASE}/payments/advance`, { driver_id, trip_id, amount_paise: amount_paise || 150000 }),
  getDriverAdvances: (driver_id: number, month?: string) =>
    api.get<{ data: any }>(`${BASE}/drivers/${driver_id}/advances`, { params: { month } }).then(r => r.data),

  // Expense queue
  getExpenseQueue: (status?: string, category?: string, page?: number) =>
    api.get<{ data: ExpenseSubmission[] }>(`${BASE}/expense-queue`, { params: { status, category, page } }).then(r => r.data),
  submitExpense: (data: any) => api.post(`${BASE}/expense-submissions`, data),
  approveExpense: (id: number, reimburse_now?: boolean) =>
    api.patch(`${BASE}/expense-submissions/${id}/approve`, { reimburse_now }),
  rejectExpense: (id: number, reason: string) =>
    api.patch(`${BASE}/expense-submissions/${id}/reject`, { reason }),

  // Payment Contacts
  getPaymentContacts: (entity_type?: string, entity_id?: number) =>
    api.get<{ data: PaymentContactItem[] }>(`${BASE}/payment-contacts`, { params: { entity_type, entity_id } }).then(r => r.data),
  createPaymentContact: (data: any) => api.post(`${BASE}/payment-contacts`, data),

  // Payment Schedules
  getPaymentSchedules: (schedule_type?: string, due_within_days?: number) =>
    api.get<{ data: PaymentScheduleItem[] }>(`${BASE}/payment-schedules`, { params: { schedule_type, due_within_days }}).then(r => r.data),
  createPaymentSchedule: (data: any) => api.post(`${BASE}/payment-schedules`, data),
  deletePaymentSchedule: (id: number) => api.delete(`${BASE}/payment-schedules/${id}`),

  // Vendor Payments
  payVendor: (data: any) => api.post(`${BASE}/payments/vendor`, data),

  // Payouts
  getPayouts: (payout_type?: string, status?: string, page?: number) =>
    api.get<{ data: PayoutItem[] }>(`${BASE}/payouts`, { params: { payout_type, status, page } }).then(r => r.data),

  // Razorpay Balance
  getRazorpayBalance: () => api.get<{ data: { balance_paise: number } }>(`${BASE}/razorpay/balance`).then(r => r.data),
};
