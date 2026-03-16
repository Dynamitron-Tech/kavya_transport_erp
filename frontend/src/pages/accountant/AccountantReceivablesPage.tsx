import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { KPICard } from '@/components/common/Modal';
import {
  Send, ChevronDown, ChevronUp,
  TrendingUp, AlertTriangle, Clock, CheckCircle,
} from 'lucide-react';
import type { AccountantReceivableItem } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function AccountantReceivablesPage() {
  const [expandedClient, setExpandedClient] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['accountant-receivables'],
    queryFn: async () => {
      try {
        const receivables = await api.get('/accountant/receivables');
        const baseItems = safeArray<any>(receivables?.items ?? receivables);

        const items = baseItems.map((item: any, index: number) => ({
          id: item.client_id ?? item.id ?? index + 1,
          client_name: item.client_name || item.client?.name || `Client #${item.client_id ?? index + 1}`,
          total_invoices: Number(item.invoice_count || 0),
          total_amount: Number(item.total_amount || item.total_due || 0),
          received_amount: Number(item.received_amount || item.amount_received || 0),
          pending_amount: Number(item.pending_amount || item.total_due || 0),
          credit_limit: Number(item.credit_limit || 0),
          credit_utilization: Number(item.credit_utilization || 0),
          aging_days: Number(item.aging_days || 0),
          aging_0_30: Number(item.aging_0_30 || 0),
          aging_31_60: Number(item.aging_31_60 || 0),
          aging_61_90: Number(item.aging_61_90 || 0),
          aging_over_90: Number(item.aging_over_90 || item.total_due || 0),
          oldest_due: item.oldest_due || new Date().toISOString(),
          last_payment_date: item.last_payment_date || new Date().toISOString(),
        }));

        const summary = {
          total_receivable: items.reduce((sum: number, item: any) => sum + item.pending_amount, 0),
          aging_0_30: items.reduce((sum: number, item: any) => sum + item.aging_0_30, 0),
          aging_31_60: items.reduce((sum: number, item: any) => sum + item.aging_31_60, 0),
          aging_61_90: items.reduce((sum: number, item: any) => sum + item.aging_61_90, 0),
          aging_over_90: items.reduce((sum: number, item: any) => sum + item.aging_over_90, 0),
        };

        return { items, summary };
      } catch {
        const invoices = await api.get('/accountant/invoices', { params: { page: 1, limit: 500 } });
        const rows = safeArray<any>(invoices?.items ?? invoices);
        const grouped: Record<string, any> = {};
        rows.forEach((inv: any) => {
          const key = inv.client_name || inv.client?.name || `Client #${inv.client_id}`;
          const due = Number(inv.amount_due || inv.balance_amount || 0);
          const total = Number(inv.total_amount || 0);
          const paid = Number(inv.amount_paid || inv.paid_amount || 0);
          const dueDate = inv.due_date ? new Date(inv.due_date) : new Date();
          const agingDays = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

          if (!grouped[key]) {
            grouped[key] = {
              id: Object.keys(grouped).length + 1,
              client_name: key,
              total_invoices: 0,
              total_amount: 0,
              received_amount: 0,
              pending_amount: 0,
              credit_limit: Number(inv.credit_limit || 0),
              credit_utilization: 0,
              aging_days: 0,
              aging_0_30: 0,
              aging_31_60: 0,
              aging_61_90: 0,
              aging_over_90: 0,
              oldest_due: inv.due_date || new Date().toISOString(),
              last_payment_date: inv.updated_at || inv.created_at || new Date().toISOString(),
            };
          }

          const bucket = grouped[key];
          bucket.total_invoices += 1;
          bucket.total_amount += total;
          bucket.received_amount += paid;
          bucket.pending_amount += due;
          bucket.aging_days = Math.max(bucket.aging_days, agingDays);

          if (agingDays <= 30) bucket.aging_0_30 += due;
          else if (agingDays <= 60) bucket.aging_31_60 += due;
          else if (agingDays <= 90) bucket.aging_61_90 += due;
          else bucket.aging_over_90 += due;
        });

        const items = Object.values(grouped).map((item: any) => ({
          ...item,
          credit_utilization: item.credit_limit > 0 ? (item.pending_amount / item.credit_limit) * 100 : 0,
        }));

        const summary = {
          total_receivable: items.reduce((sum: number, item: any) => sum + item.pending_amount, 0),
          aging_0_30: items.reduce((sum: number, item: any) => sum + item.aging_0_30, 0),
          aging_31_60: items.reduce((sum: number, item: any) => sum + item.aging_31_60, 0),
          aging_61_90: items.reduce((sum: number, item: any) => sum + item.aging_61_90, 0),
          aging_over_90: items.reduce((sum: number, item: any) => sum + item.aging_over_90, 0),
        };

        return { items, summary };
      }
    },
  });

  const items: AccountantReceivableItem[] = safeArray(data?.items ?? data);
  const summary = data?.summary || {
    total_receivable: 0, aging_0_30: 0, aging_31_60: 0, aging_61_90: 0, aging_over_90: 0,
  };

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const getAgingColor = (days: number) => {
    if (days > 90) return 'text-red-600';
    if (days > 60) return 'text-orange-600';
    if (days > 30) return 'text-amber-600';
    return 'text-green-600';
  };

  const getUtilizationColor = (pct: number) => {
    if (pct > 100) return 'text-red-600 bg-red-50';
    if (pct > 80) return 'text-orange-600 bg-orange-50';
    if (pct > 60) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts Receivable</h1>
          <p className="page-subtitle">Track outstanding amounts from clients</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Total Receivable" value={fmt(summary.total_receivable)} icon={<TrendingUp size={22} />} color="bg-blue-50 text-blue-600" />
        <KPICard title="0-30 Days" value={fmt(summary.aging_0_30)} icon={<CheckCircle size={22} />} color="bg-green-50 text-green-600" />
        <KPICard title="31-60 Days" value={fmt(summary.aging_31_60)} icon={<Clock size={22} />} color="bg-amber-50 text-amber-600" />
        <KPICard title="61-90 Days" value={fmt(summary.aging_61_90)} icon={<AlertTriangle size={22} />} color="bg-orange-50 text-orange-600" />
        <KPICard title="90+ Days" value={fmt(summary.aging_over_90)} icon={<AlertTriangle size={22} />} color="bg-red-50 text-red-600" />
      </div>

      {/* Client Receivable Cards */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-16 bg-gray-100 rounded" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">No outstanding receivables</div>
        ) : (
          items.map((client) => (
            <div key={client.id} className="card p-0 overflow-hidden">
              {/* Client Header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <span className="text-primary-600 font-bold text-sm">{client.client_name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{client.client_name}</h3>
                    <p className="text-xs text-gray-500">{client.total_invoices} invoices • Last payment: {new Date(client.last_payment_date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{fmt(client.pending_amount)}</p>
                    <p className="text-[10px] text-gray-400">Outstanding</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getUtilizationColor(client.credit_utilization)}`}>
                      {Number(client.credit_utilization ?? 0).toFixed(0)}% used
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">of {fmt(client.credit_limit)}</p>
                  </div>
                  <div className={`text-xs font-semibold ${getAgingColor(client.aging_days)}`}>
                    {client.aging_days}d oldest
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                      title="Send Reminder"
                    >
                      <Send size={12} /> Remind
                    </button>
                    {expandedClient === client.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedClient === client.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  {/* Aging Breakdown Bar */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Aging Breakdown</p>
                    <div className="flex h-6 rounded-lg overflow-hidden gap-0.5">
                      {client.aging_0_30 > 0 && (
                        <div className="bg-green-400 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${(client.aging_0_30 / client.pending_amount) * 100}%` }}>
                          {fmt(client.aging_0_30)}
                        </div>
                      )}
                      {client.aging_31_60 > 0 && (
                        <div className="bg-amber-400 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${(client.aging_31_60 / client.pending_amount) * 100}%` }}>
                          {fmt(client.aging_31_60)}
                        </div>
                      )}
                      {client.aging_61_90 > 0 && (
                        <div className="bg-orange-400 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${(client.aging_61_90 / client.pending_amount) * 100}%` }}>
                          {fmt(client.aging_61_90)}
                        </div>
                      )}
                      {client.aging_over_90 > 0 && (
                        <div className="bg-red-500 flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${(client.aging_over_90 / client.pending_amount) * 100}%` }}>
                          {fmt(client.aging_over_90)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-400" /> 0-30 days</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> 31-60 days</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400" /> 61-90 days</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> 90+ days</span>
                    </div>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Total Invoiced</p>
                      <p className="font-semibold">{fmt(client.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Total Received</p>
                      <p className="font-semibold text-green-600">{fmt(client.received_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Outstanding</p>
                      <p className="font-semibold text-red-600">{fmt(client.pending_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Oldest Due Date</p>
                      <p className="font-semibold">{new Date(client.oldest_due).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
