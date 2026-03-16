import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountantService, jobService, tripService } from '@/services/dataService';
import api from '@/services/api';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { KPICard, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import DataTable from '@/components/common/DataTable';
import {
  Landmark, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  CreditCard, CheckCircle2, Pencil, Trash2,
} from 'lucide-react';
import type { AccountantBankAccount, AccountantBankTransaction } from '@/types';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';

export default function AccountantBankingPage() {
  const qc = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [txnModal, setTxnModal] = useState<'deposit' | 'withdrawal' | 'transfer' | null>(null);
  const [deleteTxnId, setDeleteTxnId] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<AccountantBankTransaction | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', description: '' });
  const [createEntryForm, setCreateEntryForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'FREIGHT_ADVANCE',
    amount: '',
    payment_mode: 'CASH',
    reference_number: '',
    narration: '',
    job_id: '',
    trip_id: '',
    account_id: '',
  });
  const [form, setForm] = useState({
    from_account_id: '',
    to_account_id: '',
    account_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
  });

  const { data: txnData, isLoading } = useQuery({
    queryKey: ['accountant-bank-txns', selectedAccount],
    queryFn: () => api.get('/banking', { params: { account_id: selectedAccount || undefined, page: 1, limit: 100 } }),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['bank-accounts-create'],
    queryFn: () => api.get('/finance/bank-accounts'),
  });

  const { data: jobsData } = useQuery({
    queryKey: ['banking-create-jobs'],
    queryFn: () => jobService.list({ page: 1, page_size: 500 }),
  });

  const { data: tripsData } = useQuery({
    queryKey: ['banking-create-trips'],
    queryFn: () => tripService.list({ page: 1, page_size: 500 }),
  });

  const submitTxnMutation = useMutation({
    mutationFn: async () => {
      if (txnModal === 'deposit') {
        return accountantService.recordDeposit({
          account_id: Number(form.account_id),
          amount: Number(form.amount),
          date: form.date,
          description: form.description,
          reference: form.reference,
        });
      }
      if (txnModal === 'withdrawal') {
        return accountantService.recordWithdrawal({
          account_id: Number(form.account_id),
          amount: Number(form.amount),
          date: form.date,
          description: form.description,
          reference: form.reference,
        });
      }
      return accountantService.recordTransfer({
        from_account_id: Number(form.from_account_id),
        to_account_id: Number(form.to_account_id),
        amount: Number(form.amount),
        date: form.date,
        description: form.description,
        reference: form.reference,
      });
    },
    onSuccess: () => {
      setTxnModal(null);
      setForm({
        from_account_id: '',
        to_account_id: '',
        account_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
      });
      qc.invalidateQueries({ queryKey: ['accountant-bank-txns'] });
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: () => api.post('/finance/bank-transactions', {
      account_id: Number(createEntryForm.account_id),
      transaction_date: createEntryForm.entry_date,
      transaction_type: ['FREIGHT_RECEIVED'].includes(createEntryForm.entry_type) ? 'credit' : 'debit',
      amount: Number(createEntryForm.amount || 0),
      reference_number: createEntryForm.reference_number || null,
      narration: `${createEntryForm.entry_type} | ${createEntryForm.payment_mode} | ${createEntryForm.narration || ''}`
        + `${createEntryForm.job_id ? ` | Job:${createEntryForm.job_id}` : ''}`
        + `${createEntryForm.trip_id ? ` | Trip:${createEntryForm.trip_id}` : ''}`,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-bank-txns'] });
      toast.success('Banking entry created successfully.');
      setIsCreateOpen(false);
      setCreateEntryForm({
        entry_date: new Date().toISOString().split('T')[0],
        entry_type: 'FREIGHT_ADVANCE',
        amount: '',
        payment_mode: 'CASH',
        reference_number: '',
        narration: '',
        job_id: '',
        trip_id: '',
        account_id: '',
      });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const approveTxnMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        return await api.put(`/banking/${id}/approve`);
      } catch {
        return api.put(`/accountant/banking/transactions/${id}/approve`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-bank-txns'] });
      toast.success('Banking entry approved.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const deleteTxnMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        return await api.delete(`/banking/${id}`);
      } catch {
        return api.delete(`/accountant/banking/transactions/${id}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-bank-txns'] });
      toast.success('Banking entry deleted successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) throw new Error('No transaction selected');
      try {
        return await api.put(`/banking/${editItem.id}`, {
          amount: Number(editForm.amount || 0),
          narration: editForm.description,
        });
      } catch {
        return api.put(`/accountant/banking/transactions/${editItem.id}`, {
          amount: Number(editForm.amount || 0),
          narration: editForm.description,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-bank-txns'] });
      toast.success('Updated successfully');
      setEditItem(null);
    },
    onError: (error) => handleApiError(error, 'Update failed'),
  });

  const rawTransactions = safeArray<any>(txnData);
  const transactions: AccountantBankTransaction[] = rawTransactions.map((tx: any) => ({
    id: tx.id,
    date: tx.transaction_date || tx.date,
    type: tx.transaction_type || tx.type,
    status: tx.approval_status || tx.status || 'posted',
    description: tx.narration || tx.description || '-',
    reference: tx.reference_number || tx.reference || '',
    amount: Number(tx.amount || 0),
    balance: Number(tx.balance_after || tx.balance || 0),
    account: tx.account_name || (tx.account_id ? `Account #${tx.account_id}` : '-'),
  }));

  const accountMap = new Map<number, AccountantBankAccount>();
  rawTransactions.forEach((tx: any) => {
    const accountId = Number(tx.account_id || 0);
    if (!accountId) return;
    accountMap.set(accountId, {
      id: accountId,
      name: tx.account_name || `Account #${accountId}`,
      bank: tx.account_name || `Account #${accountId}`,
      account_number: tx.account_number || 'N/A',
      type: 'current',
      balance: Number(tx.balance_after || 0),
      last_transaction_date: tx.transaction_date || tx.date || new Date().toISOString(),
    });
  });
  const accounts: AccountantBankAccount[] = Array.from(accountMap.values());
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const getTypeIcon = (type: string) => {
    if (type === 'credit') return <ArrowDownLeft size={14} className="text-green-500" />;
    if (type === 'debit') return <ArrowUpRight size={14} className="text-red-500" />;
    return <ArrowLeftRight size={14} className="text-blue-500" />;
  };

  const columns = [
    {
      key: 'date' as const,
      header: 'Date',
      render: (item: AccountantBankTransaction) => (
        <span className="text-sm">{new Date(item.date).toLocaleDateString('en-IN')}</span>
      ),
    },
    {
      key: 'type' as const,
      header: 'Type',
      render: (item: AccountantBankTransaction) => (
        <div className="flex items-center gap-1.5">
          {getTypeIcon(item.type)}
          <span className="text-xs font-medium capitalize">{item.type}</span>
        </div>
      ),
    },
    {
      key: 'description' as const,
      header: 'Description',
      render: (item: AccountantBankTransaction) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{item.description}</p>
          {item.reference && <p className="text-xs text-gray-400">Ref: {item.reference}</p>}
        </div>
      ),
    },
    {
      key: 'amount' as const,
      header: 'Amount',
      render: (item: AccountantBankTransaction) => (
        <span className={`font-bold text-sm ${item.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
          {item.type === 'credit' ? '+' : '-'}{fmt(item.amount)}
        </span>
      ),
    },
    {
      key: 'balance' as const,
      header: 'Balance',
      render: (item: AccountantBankTransaction) => (
        <span className="text-sm font-medium">{fmt(item.balance)}</span>
      ),
    },
    {
      key: 'account' as const,
      header: 'Account',
      render: (item: AccountantBankTransaction) => (
        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{item.account}</span>
      ),
    },
    {
      key: 'actions' as const,
      header: 'Actions',
      render: (item: AccountantBankTransaction) => {
        const raw = rawTransactions.find((tx: any) => tx.id === item.id);
        const approvalStatus = raw?.approval_status || raw?.status || '';
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditItem(item);
                setEditForm({ amount: String(item.amount || 0), description: item.description || '' });
              }}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            {(approvalStatus === 'pending' || approvalStatus === 'pending_approval') && (
              <button
                onClick={() => approveTxnMutation.mutate(item.id)}
                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                title="Approve"
              >
                <CheckCircle2 size={14} />
              </button>
            )}
            <button
              onClick={() => {
                setDeleteTxnId(item.id);
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Banking & Cash Management</h1>
          <p className="page-subtitle">Manage bank accounts, deposits, withdrawals, and transfers</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            Add Entry
          </button>
          <button type="button" onClick={() => setTxnModal('deposit')} className="btn-primary flex items-center gap-1.5 text-sm">
            <ArrowDownLeft size={14} /> Deposit
          </button>
          <button type="button" onClick={() => setTxnModal('withdrawal')} className="btn-secondary flex items-center gap-1.5 text-sm">
            <ArrowUpRight size={14} /> Withdraw
          </button>
          <button type="button" onClick={() => setTxnModal('transfer')} className="btn-secondary flex items-center gap-1.5 text-sm">
            <ArrowLeftRight size={14} /> Transfer
          </button>
        </div>
      </div>

      {/* Total Balance KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Balance" value={fmt(totalBalance)} icon={<Landmark size={22} />} color="bg-primary-50 text-primary-600" />
        {accounts.slice(0, 3).map((acc) => (
          <KPICard
            key={acc.id}
            title={acc.bank}
            value={fmt(acc.balance)}
            icon={<CreditCard size={22} />}
            color={acc.type === 'current' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}
            change={`${acc.type} • ${acc.account_number}`}
            changeType="neutral"
          />
        ))}
      </div>

      {/* Account Cards (if more than 3) */}
      {accounts.length > 3 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {accounts.slice(3).map((acc) => (
            <div
              key={acc.id}
              className={`card cursor-pointer transition-all hover:shadow-md ${selectedAccount === acc.id ? 'ring-2 ring-primary-500' : ''}`}
              onClick={() => setSelectedAccount(selectedAccount === acc.id ? null : acc.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Landmark size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{acc.bank}</p>
                  <p className="text-xs text-gray-500">{acc.account_number}</p>
                </div>
              </div>
              <p className="text-lg font-bold mt-3">{fmt(acc.balance)}</p>
              <p className="text-xs text-gray-400 capitalize">{acc.type} account</p>
            </div>
          ))}
        </div>
      )}

      {/* Account Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setSelectedAccount(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!selectedAccount ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          All Accounts
        </button>
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => setSelectedAccount(acc.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedAccount === acc.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            {acc.bank}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Recent Transactions</h3>
        </div>
        <DataTable
          data={transactions}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No transactions found"
        />
      </div>

      {/* Transaction Modal */}
      <Modal
        isOpen={!!txnModal}
        onClose={() => setTxnModal(null)}
        title={txnModal === 'deposit' ? 'Record Deposit' : txnModal === 'withdrawal' ? 'Record Withdrawal' : 'Record Transfer'}
        size="md"
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submitTxnMutation.mutate(); }}>
          {txnModal === 'transfer' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Account</label>
                <select className="input-field" value={form.from_account_id} onChange={(e) => setForm((prev) => ({ ...prev, from_account_id: e.target.value }))}>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.bank} - {acc.account_number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
                <select className="input-field" value={form.to_account_id} onChange={(e) => setForm((prev) => ({ ...prev, to_account_id: e.target.value }))}>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.bank} - {acc.account_number}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select className="input-field" value={form.account_id} onChange={(e) => setForm((prev) => ({ ...prev, account_id: e.target.value }))}>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.bank} - {acc.account_number}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input type="number" className="input-field" placeholder="0.00" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input-field" rows={2} placeholder="Transaction description..." value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
            <input type="text" className="input-field" placeholder="Cheque/UTR/transaction reference" value={form.reference} onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setTxnModal(null)} className="btn-secondary">Cancel</button>
            <SubmitButton
              isLoading={submitTxnMutation.isPending}
              label={txnModal === 'deposit' ? 'Record Deposit' : txnModal === 'withdrawal' ? 'Record Withdrawal' : 'Record Transfer'}
              disabled={!form.amount}
            />
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Entry" size="md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createEntryMutation.mutate(); }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select className="input-field" value={createEntryForm.account_id} onChange={(e) => setCreateEntryForm((p) => ({ ...p, account_id: e.target.value }))} required>
              <option value="">Select account</option>
              {safeArray<any>((accountsData as any)?.items ?? accountsData).map((acc: any) => (
                <option key={acc.id} value={acc.id}>{acc.bank_name || acc.bank || `Account #${acc.id}`} - {acc.account_number}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Date</label>
              <input type="date" className="input-field" value={createEntryForm.entry_date} onChange={(e) => setCreateEntryForm((p) => ({ ...p, entry_date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Type</label>
              <select className="input-field" value={createEntryForm.entry_type} onChange={(e) => setCreateEntryForm((p) => ({ ...p, entry_type: e.target.value }))}>
                <option value="FREIGHT_ADVANCE">FREIGHT_ADVANCE</option>
                <option value="FREIGHT_RECEIVED">FREIGHT_RECEIVED</option>
                <option value="DRIVER_ADVANCE">DRIVER_ADVANCE</option>
                <option value="VENDOR_PAYMENT">VENDOR_PAYMENT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
              <select className="input-field" value={createEntryForm.payment_mode} onChange={(e) => setCreateEntryForm((p) => ({ ...p, payment_mode: e.target.value }))}>
                <option value="CASH">CASH</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="CHEQUE">CHEQUE</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input type="number" className="input-field" value={createEntryForm.amount} onChange={(e) => setCreateEntryForm((p) => ({ ...p, amount: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
              <input className="input-field" value={createEntryForm.reference_number} onChange={(e) => setCreateEntryForm((p) => ({ ...p, reference_number: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
            <textarea className="input-field" rows={2} value={createEntryForm.narration} onChange={(e) => setCreateEntryForm((p) => ({ ...p, narration: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job (optional)</label>
              <select className="input-field" value={createEntryForm.job_id} onChange={(e) => setCreateEntryForm((p) => ({ ...p, job_id: e.target.value }))}>
                <option value="">None</option>
                {safeArray<any>((jobsData as any)?.items ?? jobsData).map((job: any) => (
                  <option key={job.id} value={job.id}>{job.job_number || `Job #${job.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip (optional)</label>
              <select className="input-field" value={createEntryForm.trip_id} onChange={(e) => setCreateEntryForm((p) => ({ ...p, trip_id: e.target.value }))}>
                <option value="">None</option>
                {safeArray<any>((tripsData as any)?.items ?? tripsData).map((trip: any) => (
                  <option key={trip.id} value={trip.id}>{trip.trip_number || `Trip #${trip.id}`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary">Cancel</button>
            <SubmitButton isLoading={createEntryMutation.isPending} label="Save Entry" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTxnId !== null}
        title="Delete Transaction"
        message="This action cannot be undone. Are you sure you want to delete this transaction?"
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (deleteTxnId === null) return;
          deleteTxnMutation.mutate(deleteTxnId);
          setDeleteTxnId(null);
        }}
        onCancel={() => setDeleteTxnId(null)}
      />

      <Modal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title={`Edit ${editItem?.id || ''}`}
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            editMutation.mutate();
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input type="number" className="input-field" value={editForm.amount} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
            <textarea className="input-field" rows={3} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} required />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <SubmitButton isLoading={editMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>
    </div>
  );
}

