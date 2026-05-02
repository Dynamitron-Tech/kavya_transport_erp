// Finance Hub — shared TypeScript interfaces

export interface FinanceKPI {
  total_invoiced: number;
  outstanding: number;
  overdue: number;
  cash_balance: number;
  period: string;
}

export interface OverdueAlert {
  id: number;
  invoice_number: string;
  client_name: string;
  amount: number;
  days_overdue: number;
  due_date: string;
}

export interface UpcomingPayment {
  id: number;
  description: string;
  amount: number;
  due_date: string;
  vendor: string;
  type: 'payable' | 'settlement' | 'loan';
}

export interface EWBAlert {
  id: number;
  ewb_number: string;
  vehicle_number: string;
  expires_at: string;
  hours_left: number;
  lr_number?: string;
}

export interface BankingAlert {
  id: number;
  account_name: string;
  bank_name: string;
  balance: number;
  threshold: number;
}

export interface FinanceInvoice {
  id: number;
  invoice_number: string;
  client_name: string;
  amount: number;
  status: string;
  created_at: string;
  due_date?: string;
}

export interface Transaction {
  id: number;
  type: 'receivable' | 'payable' | 'expense' | 'fuel' | 'settlement';
  description: string;
  amount: number;
  date: string;
  status: string;
  reference?: string;
}

export interface BankAccount {
  id: number;
  account_name: string;
  bank_name: string;
  account_number: string;
  balance: number;
  last_reconciled?: string;
}

export interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  account: string;
}

export interface ReportFilter {
  from_date?: string;
  to_date?: string;
  client?: string;
  format?: 'pdf' | 'json' | 'excel';
  month?: number;
  year?: number;
}
