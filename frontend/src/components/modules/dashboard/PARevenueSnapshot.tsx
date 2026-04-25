// ============================================================
// PA Revenue Snapshot Widget
// Shows: Monthly revenue, expense, profit with mini sparkline
// ============================================================

import {
  TrendingUp, TrendingDown, DollarSign, ChevronRight,
  Loader2, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

interface RevenueData {
  total_revenue: number;
  total_expense: number;
  profit: number;
  profit_margin: number;
  revenue_change: number;  // % change vs previous period
  expense_change: number;
  pending_invoices: number;
  pending_amount: number;
  monthly_trend: { month: string; revenue: number; expense: number }[];
}

interface Props {
  data: RevenueData | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

const toNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const normalizeRevenue = (data: unknown): RevenueData => {
  if (Array.isArray(data)) {
    const trend = data
      .filter((row) => row && (row as any).date)
      .map((row) => ({
        month: String((row as any).date),
        revenue: toNumber((row as any).revenue),
        expense: toNumber((row as any).expense),
      }));

    const totalRevenue = trend.reduce((sum, item) => sum + item.revenue, 0);
    const totalExpense = trend.reduce((sum, item) => sum + item.expense, 0);
    const profit = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      profit,
      profit_margin: profitMargin,
      revenue_change: 0,
      expense_change: 0,
      pending_invoices: 0,
      pending_amount: 0,
      monthly_trend: trend,
    };
  }

  const safe = (data ?? {}) as Partial<RevenueData>;
  const trend = Array.isArray(safe.monthly_trend)
    ? safe.monthly_trend.map((point) => ({
      month: String(point?.month ?? ''),
      revenue: toNumber(point?.revenue),
      expense: toNumber(point?.expense),
    }))
    : [];

  return {
    total_revenue: toNumber(safe.total_revenue),
    total_expense: toNumber(safe.total_expense),
    profit: toNumber(safe.profit),
    profit_margin: toNumber(safe.profit_margin),
    revenue_change: toNumber(safe.revenue_change),
    expense_change: toNumber(safe.expense_change),
    pending_invoices: toNumber(safe.pending_invoices),
    pending_amount: toNumber(safe.pending_amount),
    monthly_trend: trend,
  };
};

const fmt = (val: number) => {
  if (Math.abs(val) >= 100000) return `₹${Number(val / 100000).toFixed(1)}L`;
  if (Math.abs(val) >= 1000) return `₹${Number(val / 1000).toFixed(1)}K`;
  return `₹${Number(val ?? 0).toLocaleString('en-IN')}`;
};

export default function PARevenueSnapshot({ data, isLoading, navigate }: Props) {
  const rev = normalizeRevenue(data);

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value > 0) return (
      <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
        <ArrowUpRight size={10} /> {Number(value ?? 0).toFixed(1)}%
      </span>
    );
    if (value < 0) return (
      <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
        <ArrowDownRight size={10} /> {Math.abs(Number(value ?? 0)).toFixed(1)}%
      </span>
    );
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-bold text-gray-400">
        <Minus size={10} /> 0%
      </span>
    );
  };

  // Mini sparkline using SVG
  const renderSparkline = () => {
    if (rev.monthly_trend.length < 2) return null;
    const values = rev.monthly_trend.map(t => t.revenue);
    const max = Math.max(...values) || 1;
    const min = Math.min(...values);
    const range = max - min || 1;
    const w = 120;
    const h = 32;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={w} height={h} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Gradient fill */}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${h} ${points} ${w},${h}`}
          fill="url(#sparkGrad)"
        />
      </svg>
    );
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Revenue Snapshot</h3>
        <button
          onClick={() => navigate('/finance/invoices')}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          Finance <ChevronRight size={12} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* Main metrics */}
          <div className="space-y-3">
            {/* Revenue */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/80 border border-blue-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp size={15} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] text-blue-500 font-medium">Revenue</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(rev.total_revenue)}</p>
                </div>
              </div>
              <ChangeIndicator value={rev.revenue_change} />
            </div>

            {/* Expense */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/80 border border-red-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <TrendingDown size={15} className="text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] text-red-500 font-medium">Expense</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(rev.total_expense)}</p>
                </div>
              </div>
              <ChangeIndicator value={-rev.expense_change} />
            </div>

            {/* Profit */}
            <div className={`flex items-center justify-between p-3 rounded-xl border ${
              rev.profit >= 0 ? 'bg-emerald-50/80 border-emerald-100' : 'bg-rose-50/80 border-rose-100'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  rev.profit >= 0 ? 'bg-emerald-100' : 'bg-rose-100'
                }`}>
                  <DollarSign size={15} className={rev.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                </div>
                <div>
                  <p className={`text-[10px] font-medium ${rev.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {rev.profit >= 0 ? 'Profit' : 'Loss'}
                  </p>
                  <p className="text-sm font-bold text-gray-900">{fmt(Math.abs(rev.profit))}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                rev.profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {Number(rev.profit_margin ?? 0).toFixed(1)}% margin
              </span>
            </div>
          </div>

          {/* Sparkline */}
          {rev.monthly_trend.length >= 2 && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 font-medium">6-month trend</p>
              {renderSparkline()}
            </div>
          )}

          {/* Pending invoices */}
          {rev.pending_invoices > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => navigate('/finance/receivables')}
                className="w-full flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-gray-600">{rev.pending_invoices} pending invoices</span>
                </div>
                <span className="text-xs font-bold text-amber-600">{fmt(rev.pending_amount)}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
