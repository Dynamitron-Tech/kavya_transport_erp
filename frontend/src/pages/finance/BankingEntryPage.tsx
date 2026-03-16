import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { financeService } from '@/services/dataService';
import {
  CreditCard, ArrowLeft, Save, IndianRupee,
  Building2, Calendar, FileText, Hash, User, Briefcase,
} from 'lucide-react';

type EntryType = 'payment_received' | 'payment_made' | 'bank_transfer' | 'cash_deposit' | 'cash_withdrawal' | 'journal';
type PaymentMethod = 'cash' | 'cheque' | 'neft' | 'rtgs' | 'upi' | 'dd';

const ENTRY_TYPES: { value: EntryType; label: string; color: string }[] = [
  { value: 'payment_received', label: 'Payment Received', color: 'bg-green-50 text-green-700 ring-green-600/20' },
  { value: 'payment_made', label: 'Payment Made', color: 'bg-red-50 text-red-700 ring-red-600/20' },
  { value: 'bank_transfer', label: 'Bank Transfer', color: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  { value: 'cash_deposit', label: 'Cash Deposit', color: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  { value: 'cash_withdrawal', label: 'Cash Withdrawal', color: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
  { value: 'journal', label: 'Journal Entry', color: 'bg-gray-50 text-gray-700 ring-gray-600/20' },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'upi', label: 'UPI' },
  { value: 'dd', label: 'Demand Draft' },
];

interface FormData {
  entry_type: EntryType;
  account: string;
  date: string;
  amount: string;
  payment_method: PaymentMethod;
  reference_number: string;
  client_id: string;
  invoice_id: string;
  job_id: string;
  description: string;
  cheque_number: string;
  cheque_date: string;
  bank_name: string;
}

export default function BankingEntryPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<FormData>({
    entry_type: 'payment_received',
    account: '',
    date: today,
    amount: '',
    payment_method: 'neft',
    reference_number: '',
    client_id: '',
    invoice_id: '',
    job_id: '',
    description: '',
    cheque_number: '',
    cheque_date: '',
    bank_name: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { data: accounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: financeService.getBankAccounts,
  });

  const { data: entryNumber } = useQuery({
    queryKey: ['next-banking-entry-number'],
    queryFn: financeService.getNextBankingEntryNumber,
  });

  const createMutation = useMutation({
    mutationFn: financeService.createBankingEntry,
    onSuccess: () => {
      navigate('/finance/payments');
    },
  });

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.account) e.account = 'Select an account';
    if (!form.date) e.date = 'Date is required';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
    if (!form.payment_method) e.payment_method = 'Select payment method';
    if (form.payment_method === 'cheque' && !form.cheque_number) e.cheque_number = 'Cheque number required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createMutation.mutate({
      ...form,
      amount: parseFloat(form.amount),
      client_id: form.client_id ? parseInt(form.client_id) : undefined,
      invoice_id: form.invoice_id ? parseInt(form.invoice_id) : undefined,
      job_id: form.job_id ? parseInt(form.job_id) : undefined,
    });
  };

  const showChequeFields = form.payment_method === 'cheque' || form.payment_method === 'dd';

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-2">
            <CreditCard size={22} className="text-primary-600" />
            New Banking Entry
          </h1>
          <p className="page-subtitle">
            Entry No: <span className="font-mono font-semibold text-primary-600">{entryNumber?.entry_number || '...'}</span>
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          {createMutation.isPending ? 'Saving...' : 'Save Entry'}
        </button>
      </div>

      {/* Entry Type Selection */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Entry Type</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ENTRY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update('entry_type', t.value)}
              className={`px-3 py-2.5 rounded-lg text-xs font-semibold ring-1 ring-inset transition-all ${
                form.entry_type === t.value
                  ? `${t.color} ring-2`
                  : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 size={14} className="inline mr-1" /> Account *
            </label>
            <select
              value={form.account}
              onChange={(e) => update('account', e.target.value)}
              className={`input-field w-full ${errors.account ? 'border-red-400' : ''}`}
            >
              <option value="">Select account...</option>
              {(accounts || []).map((acc: any) => (
                <option key={acc.id} value={acc.name}>
                  {acc.name} ({acc.bank} - {acc.account_number}) — ₹{(acc.balance ?? 0).toLocaleString('en-IN')}
                </option>
              ))}
            </select>
            {errors.account && <p className="text-xs text-red-500 mt-1">{errors.account}</p>}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1" /> Date *
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className={`input-field w-full ${errors.date ? 'border-red-400' : ''}`}
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <IndianRupee size={14} className="inline mr-1" /> Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => update('amount', e.target.value)}
                placeholder="0.00"
                className={`input-field w-full pl-8 ${errors.amount ? 'border-red-400' : ''}`}
              />
            </div>
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <CreditCard size={14} className="inline mr-1" /> Payment Method *
            </label>
            <select
              value={form.payment_method}
              onChange={(e) => update('payment_method', e.target.value)}
              className={`input-field w-full ${errors.payment_method ? 'border-red-400' : ''}`}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Hash size={14} className="inline mr-1" /> Reference / Transaction No.
            </label>
            <input
              type="text"
              value={form.reference_number}
              onChange={(e) => update('reference_number', e.target.value)}
              placeholder="e.g. NEFT ref, UPI ID, etc."
              className="input-field w-full"
            />
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User size={14} className="inline mr-1" /> Client (optional)
            </label>
            <input
              type="text"
              value={form.client_id}
              onChange={(e) => update('client_id', e.target.value)}
              placeholder="Client ID or search"
              className="input-field w-full"
            />
          </div>

          {/* Cheque fields */}
          {showChequeFields && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque / DD Number *
                </label>
                <input
                  type="text"
                  value={form.cheque_number}
                  onChange={(e) => update('cheque_number', e.target.value)}
                  placeholder="Cheque number"
                  className={`input-field w-full ${errors.cheque_number ? 'border-red-400' : ''}`}
                />
                {errors.cheque_number && <p className="text-xs text-red-500 mt-1">{errors.cheque_number}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Date</label>
                <input
                  type="date"
                  value={form.cheque_date}
                  onChange={(e) => update('cheque_date', e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Drawee Bank</label>
                <input
                  type="text"
                  value={form.bank_name}
                  onChange={(e) => update('bank_name', e.target.value)}
                  placeholder="Bank name"
                  className="input-field w-full"
                />
              </div>
            </>
          )}

          {/* Job ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Briefcase size={14} className="inline mr-1" /> Job ID (optional)
            </label>
            <input
              type="text"
              value={form.job_id}
              onChange={(e) => update('job_id', e.target.value)}
              placeholder="Link to a job"
              className="input-field w-full"
            />
          </div>

          {/* Invoice ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={14} className="inline mr-1" /> Invoice ID (optional)
            </label>
            <input
              type="text"
              value={form.invoice_id}
              onChange={(e) => update('invoice_id', e.target.value)}
              placeholder="Link to an invoice"
              className="input-field w-full"
            />
          </div>

          {/* Description - full width */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Narration</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Enter description or narration for this entry..."
              className="input-field w-full"
            />
          </div>
        </div>
      </div>

      {/* Summary Card */}
      {form.amount && Number(form.amount) > 0 && (
        <div className="card bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Entry Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-semibold capitalize">{form.entry_type.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Account</p>
              <p className="font-semibold">{form.account || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Amount</p>
              <p className="font-bold text-lg text-primary-700">₹{Number((form.amount) ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-gray-500">Method</p>
              <p className="font-semibold uppercase">{form.payment_method}</p>
            </div>
          </div>
        </div>
      )}

      {createMutation.isError && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm">
          Failed to create banking entry. Please try again.
        </div>
      )}
    </div>
  );
}
