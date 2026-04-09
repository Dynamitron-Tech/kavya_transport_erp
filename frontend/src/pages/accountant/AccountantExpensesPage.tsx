/**
 * Company Expenses Page (Accountant / Admin)
 *
 * Two tabs:
 *   1. Pending Approvals — GPay expenses from drivers/field staff waiting review
 *   2. All Expenses — filterable table of all company outgoing payments
 *
 * Smart Create modal with category-driven field logic.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { Modal, KPICard } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import DataTable, { Column } from '@/components/common/DataTable';
import {
  Receipt, Clock, Plus, ThumbsUp, ThumbsDown,
  Smartphone, Building2, CreditCard, AlertTriangle, ImageIcon, ExternalLink,
  IndianRupee, Truck, User, BadgeAlert,
} from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { useAuthStore } from '@/store/authStore';
import { handleApiError } from '@/utils/handleApiError';

type ExpenseCategory =
  | 'market_vehicle_rent' | 'driver_salary' | 'driver_advance'
  | 'staff_salary' | 'tax' | 'insurance' | 'permit_compliance'
  | 'vehicle_spare_part' | 'loading_unloading' | 'misc_field' | 'fuel';

type PaymentMethod = 'netbanking' | 'gpay_upi' | 'razorpay' | 'razorpay_payout' | 'cash' | 'cheque';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  market_vehicle_rent: 'Market Vehicle Rent',
  driver_salary:       'Driver Salary',
  driver_advance:      'Driver Advance (₹1,500)',
  staff_salary:        'Staff Salary',
  tax:                 'Tax Payment',
  insurance:           'Vehicle Insurance',
  permit_compliance:   'Permit / Compliance',
  vehicle_spare_part:  'Vehicle Spare Parts',
  loading_unloading:   'Loading / Unloading',
  misc_field:          'Misc Field Expense',
  fuel:                'Fuel',
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  market_vehicle_rent: 'bg-blue-50 text-blue-700',
  driver_salary:       'bg-indigo-50 text-indigo-700',
  driver_advance:      'bg-cyan-50 text-cyan-700',
  staff_salary:        'bg-violet-50 text-violet-700',
  tax:                 'bg-red-50 text-red-700',
  insurance:           'bg-orange-50 text-orange-700',
  permit_compliance:   'bg-amber-50 text-amber-700',
  vehicle_spare_part:  'bg-slate-50 text-slate-700',
  loading_unloading:   'bg-teal-50 text-teal-700',
  misc_field:          'bg-gray-50 text-gray-700',
  fuel:                'bg-rose-50 text-rose-700',
};

const NETBANKING_ONLY: ExpenseCategory[] = [
  'market_vehicle_rent', 'driver_salary', 'staff_salary',
  'tax', 'insurance', 'permit_compliance',
];

const GPAY_CATEGORIES: ExpenseCategory[] = [
  'vehicle_spare_part', 'loading_unloading', 'misc_field',
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  netbanking:      'Netbanking (NEFT/IMPS)',
  gpay_upi:        'GPay / UPI',
  razorpay:        'Razorpay',
  razorpay_payout: 'Razorpay Payout',
  cash:            'Cash',
  cheque:          'Cheque',
};

const fmt = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const statusColors: Record<ApprovalStatus, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const MethodBadge = ({ method }: { method: PaymentMethod }) => {
  const isGpay   = method === 'gpay_upi';
  const isRzpOut = method === 'razorpay_payout';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border
      ${isGpay ? 'bg-green-50 text-green-700 border-green-200'
        : isRzpOut ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {isGpay ? <Smartphone size={10} /> : isRzpOut ? <CreditCard size={10} /> : <Building2 size={10} />}
      {METHOD_LABELS[method] || method}
    </span>
  );
};

export default function AccountantExpensesPage() {
  const { hasAnyRole } = useAuthStore();
  const isApprover = hasAnyRole(['admin', 'accountant', 'manager'] as any);
  const qc = useQueryClient();

  const [activeTab, setActiveTab]       = useState<'pending' | 'all'>('pending');
  const [filters, setFilters]           = useState({ category: '', payment_method: '', from_date: '', to_date: '' });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
  const [rejectState, setRejectState]   = useState<{ id: number; reason: string } | null>(null);
  const [receiptModal, setReceiptModal] = useState<string | null>(null);

  const [form, setForm] = useState({
    expense_category: 'market_vehicle_rent' as ExpenseCategory,
    payment_method:   'netbanking' as PaymentMethod,
    amount: '', description: '',
    expense_date: new Date().toISOString().slice(0, 10),
    vehicle_id: '', driver_id: '', trip_id: '',
    upi_ref_number: '', netbanking_ref: '', bank_name: '',
    payee_name: '', period_from: '', period_to: '',
  });

  const [advForm, setAdvForm] = useState({ driver_id: '', trip_id: '' });

  const isNetbankingOnly = NETBANKING_ONLY.includes(form.expense_category);
  const amountRupees     = parseFloat(form.amount || '0') || 0;
  const amountPaise      = Math.round(amountRupees * 100);
  const gpayRequired     = (form.expense_category === 'vehicle_spare_part' && amountRupees > 3000)
                         || (form.expense_category === 'loading_unloading'  && amountRupees > 4000);

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['company-expenses', 'pending'],
    queryFn: () => api.get('/expenses', { params: { status: 'pending', limit: 100 } }),
  });

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['company-expenses', 'all', filters],
    queryFn: () => api.get('/expenses', {
      params: {
        limit: 200,
        ...(filters.category       ? { category:       filters.category }       : {}),
        ...(filters.payment_method ? { payment_method: filters.payment_method } : {}),
        ...(filters.from_date      ? { from_date:      filters.from_date }      : {}),
        ...(filters.to_date        ? { to_date:        filters.to_date }        : {}),
      },
    }),
    enabled: activeTab === 'all',
  });

  const { data: summaryData } = useQuery({
    queryKey: ['company-expenses', 'summary'],
    queryFn: () => api.get('/expenses/summary'),
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => api.get('/drivers', { params: { limit: 200 } }),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => api.patch(`/expenses/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-expenses'] }); toast.success('Expense approved.'); },
    onError: (e) => handleApiError(e, 'Approval failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.patch(`/expenses/${id}/reject`, { rejection_reason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-expenses'] });
      setRejectState(null);
      toast.success('Expense rejected.');
    },
    onError: (e) => handleApiError(e, 'Rejection failed'),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        expense_category: form.expense_category,
        payment_method:   form.expense_category === 'driver_advance' ? 'razorpay_payout'
                          : isNetbankingOnly ? 'netbanking'
                          : gpayRequired ? 'gpay_upi'
                          : form.payment_method,
        amount_paise:     form.expense_category === 'driver_advance' ? 150000 : amountPaise,
        description:      form.description,
        expense_date:     form.expense_date,
      };
      if (form.vehicle_id)    payload.vehicle_id    = parseInt(form.vehicle_id);
      if (form.driver_id)     payload.driver_id     = parseInt(form.driver_id);
      if (form.trip_id)       payload.trip_id       = parseInt(form.trip_id);
      if (form.upi_ref_number) payload.upi_ref_number = form.upi_ref_number;
      if (form.netbanking_ref) payload.netbanking_ref = form.netbanking_ref;
      if (form.bank_name)     payload.bank_name     = form.bank_name;
      if (form.payee_name)    payload.payee_name    = form.payee_name;
      if (form.period_from)   payload.period_from   = form.period_from;
      if (form.period_to)     payload.period_to     = form.period_to;
      return api.post('/expenses', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-expenses'] }); toast.success('Expense recorded.'); setIsCreateOpen(false); },
    onError: (e) => handleApiError(e, 'Failed to create expense'),
  });

  const advanceMut = useMutation({
    mutationFn: () => api.post('/expenses/driver-advance', {
      driver_id: parseInt(advForm.driver_id),
      ...(advForm.trip_id ? { trip_id: parseInt(advForm.trip_id) } : {}),
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['company-expenses'] });
      toast.success(`Driver advance ₹1,500 issued. ${res?.data?.payout_status || ''}`);
      setIsAdvanceOpen(false);
      setAdvForm({ driver_id: '', trip_id: '' });
    },
    onError: (e) => handleApiError(e, 'Failed to issue advance'),
  });

  const pendingItems = safeArray<any>((pendingData as any)?.data ?? pendingData);
  const allItems     = safeArray<any>((allData as any)?.data ?? allData);
  const summaryItems = safeArray<any>((summaryData as any)?.data ?? summaryData);
  const drivers      = safeArray<any>((driversData as any)?.data?.items ?? (driversData as any)?.items ?? driversData);
  const thisMonthTotal = summaryItems.reduce((s: number, r: any) => s + (r.total_paise || 0), 0);

  const pendingCols: Column<any>[] = [
    { key: 'expense_date', header: 'Date', render: (e) => <span className="text-sm text-gray-600">{e.expense_date}</span> },
    {
      key: 'expense_category', header: 'Category',
      render: (e) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[e.expense_category as ExpenseCategory] || 'bg-gray-50 text-gray-700'}`}>
          {CATEGORY_LABELS[e.expense_category as ExpenseCategory] || e.expense_category}
        </span>
      ),
    },
    { key: 'amount_paise', header: 'Amount', render: (e) => <span className="font-bold text-sm">{fmt(e.amount_paise)}</span> },
    { key: 'payment_method', header: 'Method', render: (e) => <MethodBadge method={e.payment_method} /> },
    {
      key: 'upi_ref_number', header: 'UPI Ref',
      render: (e) => e.upi_ref_number
        ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{e.upi_ref_number}</span>
        : <span className="text-gray-400 text-xs">—</span>,
    },
    {
      key: 'receipt_image_url', header: 'Receipt',
      render: (e) => e.receipt_image_url
        ? <button onClick={() => setReceiptModal(e.receipt_image_url)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ImageIcon size={12} /> View</button>
        : <span className="text-gray-400 text-xs">None</span>,
    },
    { key: 'description', header: 'Description', render: (e) => <span className="text-sm text-gray-700">{e.description || '—'}</span> },
    {
      key: 'id', header: 'Actions',
      render: (e) => isApprover ? (
        <div className="flex items-center gap-1">
          <button onClick={() => approveMut.mutate(e.id)} disabled={approveMut.isPending} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Approve"><ThumbsUp size={14} /></button>
          <button onClick={() => setRejectState({ id: e.id, reason: '' })} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors" title="Reject"><ThumbsDown size={14} /></button>
        </div>
      ) : null,
    },
  ];

  const allCols: Column<any>[] = [
    { key: 'expense_date', header: 'Date', render: (e) => <span className="text-sm">{e.expense_date}</span> },
    {
      key: 'expense_category', header: 'Category',
      render: (e) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[e.expense_category as ExpenseCategory] || 'bg-gray-50 text-gray-700'}`}>
          {CATEGORY_LABELS[e.expense_category as ExpenseCategory] || e.expense_category}
        </span>
      ),
    },
    { key: 'description', header: 'Description', render: (e) => <span className="text-sm text-gray-700">{e.description || '—'}</span> },
    { key: 'amount_paise', header: 'Amount', sortable: true, render: (e) => <span className="font-semibold text-sm">{fmt(e.amount_paise)}</span> },
    { key: 'payment_method', header: 'Method', render: (e) => <MethodBadge method={e.payment_method} /> },
    {
      key: 'upi_ref_number', header: 'Ref #',
      render: (e) => {
        const ref = e.upi_ref_number || e.netbanking_ref;
        return ref ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{ref}</span> : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      key: 'approval_status', header: 'Status',
      render: (e) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[e.approval_status as ApprovalStatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {e.approval_status}
        </span>
      ),
    },
    {
      key: 'driver_id', header: 'Linked To',
      render: (e) => (
        <div className="text-xs text-gray-500 space-y-0.5">
          {e.driver_id && <div className="flex items-center gap-1"><User size={10} /> Driver #{e.driver_id}</div>}
          {e.vehicle_id && <div className="flex items-center gap-1"><Truck size={10} /> Vehicle #{e.vehicle_id}</div>}
          {e.trip_id && <div className="flex items-center gap-1"><Receipt size={10} /> Trip #{e.trip_id}</div>}
          {!e.driver_id && !e.vehicle_id && !e.trip_id && '—'}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><IndianRupee size={22} className="text-primary-600" /> Company Expenses</h1>
          <p className="page-subtitle">Field GPay · Salaries · Rent · Insurance · Permits · Driver Advances</p>
        </div>
        {isApprover && (
          <div className="flex items-center gap-2">
            <button onClick={() => setIsAdvanceOpen(true)} className="btn-secondary flex items-center gap-2 text-cyan-700 border-cyan-300 hover:bg-cyan-50">
              <BadgeAlert size={15} /> Issue Driver Advance
            </button>
            <button onClick={() => setIsCreateOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus size={15} /> Record Expense
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Pending Approvals" value={String(pendingItems.length)} icon={<Clock size={22} />} color="bg-amber-50 text-amber-600" />
        <KPICard title="This Month Total" value={fmt(thisMonthTotal)} icon={<IndianRupee size={22} />} color="bg-blue-50 text-blue-600" />
        <KPICard title="GPay Expenses" value={String(summaryItems.filter((r: any) => r.payment_method === 'gpay_upi').reduce((s: number, r: any) => s + (r.count || 0), 0))} icon={<Smartphone size={22} />} color="bg-green-50 text-green-600" />
        <KPICard title="Netbanking Paid" value={fmt(summaryItems.filter((r: any) => r.payment_method === 'netbanking').reduce((s: number, r: any) => s + (r.total_paise || 0), 0))} icon={<Building2 size={22} />} color="bg-indigo-50 text-indigo-600" />
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('pending')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Clock size={14} /> Pending Approvals
          {pendingItems.length > 0 && <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingItems.length}</span>}
        </button>
        <button onClick={() => setActiveTab('all')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          All Expenses
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-amber-50">
            <p className="text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle size={14} /> Review GPay receipts before approving. Check UPI ref against receipt photo.
            </p>
          </div>
          <DataTable data={pendingItems} columns={pendingCols} isLoading={pendingLoading} emptyMessage="No pending expenses — all caught up!" />
        </div>
      )}

      {activeTab === 'all' && (
        <div className="space-y-3">
          <div className="card">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select className="input-field text-sm" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
                  <option value="">All categories</option>
                  {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select className="input-field text-sm" value={filters.payment_method} onChange={(e) => setFilters((p) => ({ ...p, payment_method: e.target.value }))}>
                  <option value="">All methods</option>
                  {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input type="date" className="input-field text-sm" value={filters.from_date} onChange={(e) => setFilters((p) => ({ ...p, from_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input type="date" className="input-field text-sm" value={filters.to_date} onChange={(e) => setFilters((p) => ({ ...p, to_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="card p-0 overflow-hidden">
            <DataTable data={allItems} columns={allCols} isLoading={allLoading} emptyMessage="No expenses found." />
          </div>
        </div>
      )}

      {/* Create Expense Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Record Expense" size="lg">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expense Category *</label>
            <select className="input-field" value={form.expense_category} onChange={(e) => {
              const cat = e.target.value as ExpenseCategory;
              setForm((p) => ({
                ...p, expense_category: cat,
                payment_method: NETBANKING_ONLY.includes(cat) ? 'netbanking' : GPAY_CATEGORIES.includes(cat) ? 'gpay_upi' : cat === 'driver_advance' ? 'razorpay_payout' : p.payment_method,
              }));
            }} required>
              {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            {form.expense_category === 'driver_advance'
              ? <input type="text" className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" value="₹1,500 (fixed)" readOnly />
              : <input type="number" className="input-field" placeholder="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} min={1} required />
            }
          </div>

          {gpayRequired && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Amount above {form.expense_category === 'vehicle_spare_part' ? '₹3,000' : '₹4,000'} — must use GPay. UPI ref is required.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            {isNetbankingOnly || form.expense_category === 'driver_advance'
              ? <input type="text" className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" value={form.expense_category === 'driver_advance' ? 'Razorpay Payout' : 'Netbanking (NEFT/IMPS/RTGS)'} readOnly />
              : (
                <select className="input-field" value={gpayRequired ? 'gpay_upi' : form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value as PaymentMethod }))} disabled={gpayRequired} required>
                  <option value="gpay_upi">GPay / UPI</option>
                  <option value="cash">Cash</option>
                  {!GPAY_CATEGORIES.includes(form.expense_category) && <option value="netbanking">Netbanking</option>}
                  <option value="cheque">Cheque</option>
                </select>
              )
            }
          </div>

          {(form.payment_method === 'gpay_upi' || gpayRequired) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GPay UPI Ref Number {gpayRequired ? '*' : ''}</label>
              <input type="text" className="input-field font-mono" placeholder="e.g. T20260409123456789" value={form.upi_ref_number} onChange={(e) => setForm((p) => ({ ...p, upi_ref_number: e.target.value }))} required={gpayRequired} />
            </div>
          )}

          {(form.payment_method === 'netbanking' || isNetbankingOnly) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NEFT/IMPS Ref (UTR)</label>
                <input type="text" className="input-field font-mono" placeholder="Bank UTR number" value={form.netbanking_ref} onChange={(e) => setForm((p) => ({ ...p, netbanking_ref: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input type="text" className="input-field" placeholder="HDFC / ICICI / SBI..." value={form.bank_name} onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))} />
              </div>
            </div>
          )}

          {isNetbankingOnly && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payee / Vendor Name</label>
                <input type="text" className="input-field" placeholder="Who was paid?" value={form.payee_name} onChange={(e) => setForm((p) => ({ ...p, payee_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense Date *</label>
                <input type="date" className="input-field" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period From</label>
                <input type="date" className="input-field" value={form.period_from} onChange={(e) => setForm((p) => ({ ...p, period_from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period To</label>
                <input type="date" className="input-field" value={form.period_to} onChange={(e) => setForm((p) => ({ ...p, period_to: e.target.value }))} />
              </div>
            </div>
          )}

          {form.expense_category === 'driver_advance' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
              <select className="input-field" value={form.driver_id} onChange={(e) => setForm((p) => ({ ...p, driver_id: e.target.value }))} required>
                <option value="">Select driver</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.first_name} {d.last_name} — {d.upi_id ? '✓ UPI' : '⚠ No UPI'}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input-field" rows={2} placeholder="Brief description..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary">Cancel</button>
            <SubmitButton isLoading={createMut.isPending} label={form.expense_category === 'driver_advance' ? 'Issue Advance' : 'Record Expense'} loadingLabel="Saving..." disabled={form.expense_category !== 'driver_advance' && (!form.amount || amountPaise <= 0)} />
          </div>
        </form>
      </Modal>

      {/* Driver Advance Quick Modal */}
      <Modal isOpen={isAdvanceOpen} onClose={() => setIsAdvanceOpen(false)} title="Issue Driver Advance — ₹1,500" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-800">
            Standard ₹1,500 advance issued to driver UPI <strong>before trip starts</strong>. Requires UPI ID on driver profile.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
            <select className="input-field" value={advForm.driver_id} onChange={(e) => setAdvForm((p) => ({ ...p, driver_id: e.target.value }))} required>
              <option value="">Select driver</option>
              {drivers.map((d: any) => (
                <option key={d.id} value={d.id}>{d.first_name} {d.last_name} — {d.upi_id ? '✓ UPI: ' + d.upi_id : '⚠ No UPI'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trip # (optional)</label>
            <input type="number" className="input-field" placeholder="Trip ID" value={advForm.trip_id} onChange={(e) => setAdvForm((p) => ({ ...p, trip_id: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setIsAdvanceOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" disabled={!advForm.driver_id || advanceMut.isPending} onClick={() => advanceMut.mutate()} className="btn-primary">
              {advanceMut.isPending ? 'Issuing...' : 'Issue ₹1,500 Advance'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Reason Modal */}
      {rejectState && (
        <Modal isOpen onClose={() => setRejectState(null)} title="Reject Expense" size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
              <textarea className="input-field" rows={3} placeholder="Explain why..." value={rejectState.reason} onChange={(e) => setRejectState((p) => p ? { ...p, reason: e.target.value } : null)} />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={() => setRejectState(null)} className="btn-secondary">Cancel</button>
              <button type="button" disabled={!rejectState.reason.trim() || rejectMut.isPending} onClick={() => rejectMut.mutate({ id: rejectState.id, reason: rejectState.reason })} className="btn-danger">
                {rejectMut.isPending ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Receipt Image Viewer */}
      {receiptModal && (
        <Modal isOpen onClose={() => setReceiptModal(null)} title="Receipt" size="md">
          <div className="text-center">
            <img src={receiptModal} alt="Expense receipt" className="max-w-full rounded-lg border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).alt = 'Image not available'; }} />
            <a href={receiptModal} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <ExternalLink size={14} /> Open full size
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
