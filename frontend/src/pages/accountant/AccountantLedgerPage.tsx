import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { KPICard } from '@/components/common/Modal';
import DataTable from '@/components/common/DataTable';
import {
  BookOpen, Users, Truck, Building, ChevronRight, ArrowLeft,
} from 'lucide-react';
import type { AccountantLedgerAccount, AccountantLedgerEntry } from '@/types';
import { safeArray } from '@/utils/helpers';

const ACCOUNT_TYPE_CONFIG: Record<string, { icon: typeof Users; color: string }> = {
  client: { icon: Users, color: 'bg-blue-50 text-blue-600' },
  vendor: { icon: Building, color: 'bg-purple-50 text-purple-600' },
  vehicle: { icon: Truck, color: 'bg-orange-50 text-orange-600' },
  driver: { icon: Users, color: 'bg-green-50 text-green-600' },
  bank: { icon: BookOpen, color: 'bg-teal-50 text-teal-600' },
};

export default function AccountantLedgerPage() {
  const [selectedAccount, setSelectedAccount] = useState<AccountantLedgerAccount | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: ledgerData, isLoading: entriesLoading } = useQuery({
    queryKey: ['accountant-ledger-entries'],
    queryFn: () => api.get('/accountant/ledger', { params: { page: 1, limit: 100 } }),
  });

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
  };

  const allEntries = safeArray<any>((ledgerData as any)?.data ?? (ledgerData as any)?.items ?? ledgerData).map((item: any) => ({
    id: item.id,
    date: item.entry_date || item.date,
    description: item.narration || item.description || '-',
    reference_number: item.reference_number || '',
    reference_type: item.reference_type || 'entry',
    debit: Number(item.debit || 0),
    credit: Number(item.credit || 0),
    balance: Number(item.balance || 0),
    account_name: item.account_name || 'General',
  }));

  const accountBuckets = new Map<string, AccountantLedgerAccount>();
  allEntries.forEach((entry) => {
    if (!accountBuckets.has(entry.account_name)) {
      accountBuckets.set(entry.account_name, {
        id: accountBuckets.size + 1,
        name: entry.account_name,
        account_type: 'bank',
        balance: 0,
        debit_total: 0,
        credit_total: 0,
        entries_count: 0,
      });
    }
    const bucket = accountBuckets.get(entry.account_name)!;
    bucket.debit_total += entry.debit;
    bucket.credit_total += entry.credit;
    bucket.balance = entry.balance;
    bucket.entries_count += 1;
  });

  const accounts: AccountantLedgerAccount[] = Array.from(accountBuckets.values());

  const entries: AccountantLedgerEntry[] = selectedAccount
    ? allEntries.filter((entry) => entry.account_name === selectedAccount.name)
    : allEntries;

  const accountsLoading = entriesLoading;

  const filteredAccounts = typeFilter === 'all'
    ? accounts
    : accounts.filter((a) => a.account_type === typeFilter);

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const accountTypes = ['all', ...new Set(accounts.map((a) => a.account_type))];

  // Entries table columns
  const entryColumns = [
    {
      key: 'date' as const,
      header: 'Date',
      render: (item: AccountantLedgerEntry) => (
        <span className="text-sm">{formatDate(item.date)}</span>
      ),
    },
    {
      key: 'description' as const,
      header: 'Particulars',
      render: (item: AccountantLedgerEntry) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{item.description}</p>
          {item.reference_number && <p className="text-xs text-gray-400">Ref: {item.reference_number}</p>}
        </div>
      ),
    },
    {
      key: 'voucher_type' as const,
      header: 'Voucher',
      render: (item: AccountantLedgerEntry) => (
        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full capitalize">{item.reference_type}</span>
      ),
    },
    {
      key: 'debit' as const,
      header: 'Debit',
      render: (item: AccountantLedgerEntry) => (
        <span className={`text-sm font-semibold ${item.debit > 0 ? 'text-red-600' : 'text-gray-300'}`}>
          {item.debit > 0 ? fmt(item.debit) : '—'}
        </span>
      ),
    },
    {
      key: 'credit' as const,
      header: 'Credit',
      render: (item: AccountantLedgerEntry) => (
        <span className={`text-sm font-semibold ${item.credit > 0 ? 'text-green-600' : 'text-gray-300'}`}>
          {item.credit > 0 ? fmt(item.credit) : '—'}
        </span>
      ),
    },
    {
      key: 'running_balance' as const,
      header: 'Balance',
      render: (item: AccountantLedgerEntry) => (
        <span className="text-sm font-bold">{fmt(item.balance)}</span>
      ),
    },
  ];

  // Account detail view
  if (selectedAccount) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedAccount(null)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{selectedAccount.name}</h1>
            <p className="page-subtitle capitalize">{selectedAccount.account_type} Account • Current Balance: {fmt(selectedAccount.balance)}</p>
          </div>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-3 gap-4">
          <KPICard title="Total Debit" value={fmt(selectedAccount.debit_total)} icon={<BookOpen size={22} />} color="bg-red-50 text-red-600" />
          <KPICard title="Total Credit" value={fmt(selectedAccount.credit_total)} icon={<BookOpen size={22} />} color="bg-green-50 text-green-600" />
          <KPICard
            title="Balance"
            value={fmt(selectedAccount.balance)}
            icon={<BookOpen size={22} />}
            color={selectedAccount.balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}
          />
        </div>

        {/* Entries Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Ledger Entries</h3>
          </div>
          <DataTable
            data={entries}
            columns={entryColumns}
            isLoading={entriesLoading}
            emptyMessage="No entries found"
          />
        </div>
      </div>
    );
  }

  // Accounts list view
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">General Ledger</h1>
          <p className="page-subtitle">View all ledger accounts and their entries</p>
        </div>
      </div>

      {/* Type-wise summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(ACCOUNT_TYPE_CONFIG).map(([type, cfg]) => {
          const typeAccounts = accounts.filter((a) => a.account_type === type);
          const totalBal = typeAccounts.reduce((s, a) => s + a.balance, 0);
          const Icon = cfg.icon;
          return (
            <KPICard
              key={type}
              title={`${type.charAt(0).toUpperCase() + type.slice(1)}s`}
              value={fmt(totalBal)}
              icon={<Icon size={22} />}
              color={cfg.color}
              change={`${typeAccounts.length} accounts`}
              changeType="neutral"
            />
          );
        })}
      </div>

      {/* Type Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {accountTypes.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              typeFilter === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {type === 'all' ? 'All' : `${type}s`}
          </button>
        ))}
      </div>

      {/* Accounts List */}
      <div className="space-y-2">
        {accountsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse"><div className="h-12 bg-gray-100 rounded" /></div>
          ))
        ) : filteredAccounts.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">No accounts found</div>
        ) : (
          filteredAccounts.map((account) => {
            const cfg = ACCOUNT_TYPE_CONFIG[account.account_type] || { icon: BookOpen, color: 'bg-gray-50 text-gray-600' };
            const Icon = cfg.icon;
            return (
              <div
                key={account.id}
                className="card flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
                onClick={() => setSelectedAccount(account)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{account.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">{account.account_type} • {account.entries_count} entries</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Debit</p>
                    <p className="text-sm font-medium text-red-600">{fmt(account.debit_total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Credit</p>
                    <p className="text-sm font-medium text-green-600">{fmt(account.credit_total)}</p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-xs text-gray-400">Balance</p>
                    <p className="text-sm font-bold">{fmt(account.balance)}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
