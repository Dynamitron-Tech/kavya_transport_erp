import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/dataService';
import { useAuthStore } from '@/store/authStore';
import {
  BarChart3, Truck, Users, Fuel, DollarSign, TrendingUp,
  MapPin, Building2, Wrench, Download, FileSpreadsheet,
  ShieldCheck, ArrowLeft, Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';


// ── Helpers ───────────────────────────────────────────────────────────────────
const COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
];

const inr = (n: number | null | undefined) =>
  `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const fmtNum = (n: number | null | undefined, dec = 1) =>
  (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

type Period = 'week' | 'month' | 'year' | 'custom';

function periodDates(p: Period): { from: string; to: string } {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const to = toStr(today);
  const from = new Date(today);
  if (p === 'week') from.setDate(today.getDate() - 7);
  else if (p === 'month') from.setDate(today.getDate() - 30);
  else if (p === 'year') from.setFullYear(today.getFullYear() - 1);
  return { from: toStr(from), to };
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center py-16 text-gray-400">
      <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">No data for selected period</p>
      <p className="text-sm mt-1">Try a different date range</p>
    </div>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number | null)[][] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {headers.map((h) => (
              <th key={h} className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{cell ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-700 mb-2">{children}</p>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-report renderers
// ─────────────────────────────────────────────────────────────────────────────

function TripSummaryReport({ items }: { items: any[] }) {
  const total = items.length;
  const completed = items.filter((t) => t.status === 'completed').length;
  const totalDist = items.reduce((s, t) => s + (t.distance_km || 0), 0);
  const totalProfit = items.reduce((s, t) => s + (t.profit || 0), 0);
  const byStatus = Object.entries(
    items.reduce((m: any, t) => { const k = t.status || 'unknown'; m[k] = (m[k] || 0) + 1; return m; }, {})
  ).map(([status, count]) => ({ status, count }));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Trips" value={String(total)} />
        <KPI label="Completed" value={String(completed)} sub={total ? `${Math.round((completed / total) * 100)}% completion rate` : undefined} />
        <KPI label="Total Distance" value={`${fmtNum(totalDist, 0)} km`} />
        <KPI label="Net Profit" value={inr(totalProfit)} />
      </div>
      <div className="mb-5">
        <SectionLabel>Trips by Status</SectionLabel>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byStatus} barSize={44}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Trips" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Trip #', 'Driver', 'Vehicle', 'Route', 'Distance (km)', 'Freight', 'Expenses', 'Profit', 'Status']}
        rows={items.slice(0, 50).map((t) => [
          t.trip_number, t.driver_name, t.vehicle_number,
          `${t.origin || '—'} → ${t.destination || '—'}`,
          fmtNum(t.distance_km, 0), inr(t.freight_amount), inr(t.expense_total), inr(t.profit), t.status,
        ])}
      />
    </>
  );
}

function VehiclePerformanceReport({ items }: { items: any[] }) {
  const top15 = [...items].sort((a, b) => b.total_trips - a.total_trips).slice(0, 15);
  const avgUtil = items.length ? items.reduce((s, v) => s + (v.utilization_percent || 0), 0) / items.length : 0;
  const totalRev = items.reduce((s, v) => s + (v.total_revenue || 0), 0);
  const kmlItems = items.filter((v) => v.avg_km_per_litre > 0);
  const avgKml = kmlItems.length ? kmlItems.reduce((s, v) => s + v.avg_km_per_litre, 0) / kmlItems.length : 0;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Vehicles" value={String(items.length)} />
        <KPI label="Avg Utilization" value={`${fmtNum(avgUtil)}%`} />
        <KPI label="Avg Mileage" value={`${fmtNum(avgKml)} km/L`} />
        <KPI label="Total Revenue" value={inr(totalRev)} />
      </div>
      <div className="mb-5">
        <SectionLabel>Trips per Vehicle (Top 15)</SectionLabel>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top15} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="vehicle_number" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any) => [v, 'Trips']} />
            <Bar dataKey="total_trips" fill="#10b981" radius={[4, 4, 0, 0]} name="Trips" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Vehicle', 'Type', 'Trips', 'Distance (km)', 'Fuel (L)', 'km/L', 'Revenue', 'Expenses', 'Utilization %']}
        rows={items.map((v) => [
          v.vehicle_number, v.vehicle_type, v.total_trips,
          fmtNum(v.total_distance_km, 0), fmtNum(v.total_fuel_litres, 0), fmtNum(v.avg_km_per_litre),
          inr(v.total_revenue), inr(v.total_expenses), `${fmtNum(v.utilization_percent)}%`,
        ])}
      />
    </>
  );
}

function DriverPerformanceReport({ items }: { items: any[] }) {
  const top15 = [...items].sort((a, b) => b.total_trips - a.total_trips).slice(0, 15);
  const totalTrips = items.reduce((s, d) => s + (d.total_trips || 0), 0);
  const totalDist = items.reduce((s, d) => s + (d.total_distance_km || 0), 0);
  const onTime = items.reduce((s, d) => s + (d.on_time_deliveries || 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Active Drivers" value={String(items.filter((d) => d.total_trips > 0).length)} />
        <KPI label="Total Trips" value={String(totalTrips)} />
        <KPI label="Total Distance" value={`${fmtNum(totalDist, 0)} km`} />
        <KPI label="On-Time Deliveries" value={String(onTime)} />
      </div>
      <div className="mb-5">
        <SectionLabel>Trips & On-Time by Driver (Top 15)</SectionLabel>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top15} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="driver_name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_trips" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Total Trips" />
            <Bar dataKey="on_time_deliveries" fill="#10b981" radius={[3, 3, 0, 0]} name="On Time" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Driver', 'Trips', 'Distance (km)', 'On-Time', 'Expenses Submitted', 'Approved', 'Attendance Days']}
        rows={items.map((d) => [
          d.driver_name, d.total_trips, fmtNum(d.total_distance_km, 0),
          d.on_time_deliveries, inr(d.total_expenses_submitted), inr(d.expenses_approved), d.attendance_days,
        ])}
      />
    </>
  );
}

function FuelAnalysisReport({ items }: { items: any[] }) {
  const totalLitres = items.reduce((s, f) => s + (f.litres_filled || 0), 0);
  const totalCost = items.reduce((s, f) => s + (f.total_amount || 0), 0);
  const avgRate = totalLitres ? totalCost / totalLitres : 0;
  const kmlItems = items.filter((f) => f.km_per_litre > 0);
  const avgKml = kmlItems.length ? kmlItems.reduce((s, f) => s + f.km_per_litre, 0) / kmlItems.length : 0;

  const byVehicle = Object.values(
    items.reduce((m: any, f) => {
      if (!m[f.vehicle_number]) m[f.vehicle_number] = { vehicle: f.vehicle_number, cost: 0 };
      m[f.vehicle_number].cost += f.total_amount || 0;
      return m;
    }, {})
  ).sort((a: any, b: any) => b.cost - a.cost).slice(0, 12) as any[];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Litres Filled" value={`${fmtNum(totalLitres, 0)} L`} />
        <KPI label="Total Fuel Cost" value={inr(totalCost)} />
        <KPI label="Avg Rate / Litre" value={`${inr(avgRate)}/L`} />
        <KPI label="Avg Mileage" value={`${fmtNum(avgKml)} km/L`} />
      </div>
      <div className="mb-5">
        <SectionLabel>Fuel Cost by Vehicle (Top 12)</SectionLabel>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byVehicle} barSize={30}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="vehicle" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => [inr(v), 'Cost']} />
            <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Fuel Cost" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Date', 'Vehicle', 'Station', 'Litres', 'Rate/L', 'Total', 'Odometer', 'km/L']}
        rows={items.slice(0, 50).map((f) => [
          f.fill_date ? new Date(f.fill_date + 'T00:00:00').toLocaleDateString('en-IN') : '—',
          f.vehicle_number, f.fuel_station || '—',
          fmtNum(f.litres_filled), inr(f.rate_per_litre), inr(f.total_amount),
          fmtNum(f.odometer_reading, 0), fmtNum(f.km_per_litre),
        ])}
      />
    </>
  );
}

function RevenueAnalysisReport({ items }: { items: any[] }) {
  const totalInvoiced = items.reduce((s, r) => s + (r.total_invoices || 0), 0);
  const totalPaid = items.reduce((s, r) => s + (r.total_paid || 0), 0);
  const totalOutstanding = items.reduce((s, r) => s + (r.total_outstanding || 0), 0);
  const collectionRate = totalInvoiced ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Invoiced" value={inr(totalInvoiced)} />
        <KPI label="Collected" value={inr(totalPaid)} sub={`${collectionRate}% collection rate`} />
        <KPI label="Outstanding" value={inr(totalOutstanding)} />
        <KPI label="Months in Range" value={String(items.length)} />
      </div>
      <div className="mb-5">
        <SectionLabel>Monthly Revenue Trend</SectionLabel>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={items}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => [inr(v)]} />
            <Legend />
            <Line type="monotone" dataKey="total_invoices" stroke="#6366f1" name="Invoiced" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="total_paid" stroke="#10b981" name="Collected" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="total_outstanding" stroke="#ef4444" name="Outstanding" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Month', 'Total Invoiced', 'Collected', 'Outstanding', 'Invoice Count']}
        rows={items.map((r) => [r.month, inr(r.total_invoices), inr(r.total_paid), inr(r.total_outstanding), r.invoice_count])}
      />
    </>
  );
}

function ExpenseAnalysisReport({ items }: { items: any[] }) {
  const totalExpenses = items.reduce((s, e) => s + (e.total_amount || 0), 0);
  const totalApproved = items.reduce((s, e) => s + (e.approved_total || 0), 0);
  const totalPending = items.reduce((s, e) => s + (e.pending_total || 0), 0);
  const approvalRate = totalExpenses ? Math.round((totalApproved / totalExpenses) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Expenses" value={inr(totalExpenses)} />
        <KPI label="Approved" value={inr(totalApproved)} sub={`${approvalRate}% approval rate`} />
        <KPI label="Pending" value={inr(totalPending)} />
        <KPI label="Categories" value={String(items.length)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div>
          <SectionLabel>Expense Breakdown by Category</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={items}
                dataKey="total_amount"
                nameKey="expense_type"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ expense_type, percent }: any) => `${expense_type} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {items.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => [inr(v)]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <SectionLabel>Approved vs Pending</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={items} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="expense_type" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [inr(v)]} />
              <Legend />
              <Bar dataKey="approved_total" fill="#10b981" name="Approved" radius={[3, 3, 0, 0]} />
              <Bar dataKey="pending_total" fill="#f59e0b" name="Pending" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ReportTable
        headers={['Category', 'Total', 'Count', 'Avg Amount', 'Approved', 'Pending']}
        rows={items.map((e) => [e.expense_type, inr(e.total_amount), e.count, inr(e.avg_amount), inr(e.approved_total), inr(e.pending_total)])}
      />
    </>
  );
}

function RouteAnalysisReport({ items }: { items: any[] }) {
  const topRoutes = items.slice(0, 12).map((r) => ({
    route: `${r.origin || '?'} → ${r.destination || '?'}`,
    revenue: r.total_revenue,
  }));
  const totalTrips = items.reduce((s, r) => s + (r.total_trips || 0), 0);
  const totalRev = items.reduce((s, r) => s + (r.total_revenue || 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Active Routes" value={String(items.length)} />
        <KPI label="Total Trips" value={String(totalTrips)} />
        <KPI label="Total Revenue" value={inr(totalRev)} />
        <KPI label="Avg Revenue / Route" value={inr(items.length ? totalRev / items.length : 0)} />
      </div>
      <div className="mb-5">
        <SectionLabel>Revenue by Route (Top 12)</SectionLabel>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topRoutes} layout="vertical" barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="route" tick={{ fontSize: 10 }} width={140} />
            <Tooltip formatter={(v: any) => [inr(v)]} />
            <Bar dataKey="revenue" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Origin', 'Destination', 'Trips', 'Avg Freight', 'Avg Distance (km)', 'Total Revenue', 'Top Vehicle']}
        rows={items.map((r) => [
          r.origin || '—', r.destination || '—', r.total_trips,
          inr(r.avg_freight_amount), fmtNum(r.avg_distance_km, 0), inr(r.total_revenue), r.most_used_vehicle || '—',
        ])}
      />
    </>
  );
}

function ClientOutstandingReport({ items }: { items: any[] }) {
  const top12 = items.slice(0, 12).map((c) => ({ name: c.client_name, outstanding: c.outstanding_amount, overdue: c.overdue_amount }));
  const totalOutstanding = items.reduce((s, c) => s + (c.outstanding_amount || 0), 0);
  const totalOverdue = items.reduce((s, c) => s + (c.overdue_amount || 0), 0);
  const totalInvoiced = items.reduce((s, c) => s + (c.total_invoiced || 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Clients" value={String(items.length)} />
        <KPI label="Total Invoiced" value={inr(totalInvoiced)} />
        <KPI label="Outstanding" value={inr(totalOutstanding)} />
        <KPI label="Overdue" value={inr(totalOverdue)} sub="Past due date" />
      </div>
      <div className="mb-5">
        <SectionLabel>Outstanding vs Overdue by Client (Top 12)</SectionLabel>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={top12} barSize={22}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => [inr(v)]} />
            <Legend />
            <Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" radius={[4, 4, 0, 0]} />
            <Bar dataKey="overdue" fill="#ef4444" name="Overdue" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Client', 'GSTIN', 'Total Invoiced', 'Paid', 'Outstanding', 'Overdue', 'Invoices', 'Oldest Due']}
        rows={items.map((c) => [
          c.client_name, c.gstin || '—', inr(c.total_invoiced), inr(c.total_paid),
          inr(c.outstanding_amount), inr(c.overdue_amount), c.invoice_count,
          c.oldest_invoice_date ? new Date(c.oldest_invoice_date + 'T00:00:00').toLocaleDateString('en-IN') : '—',
        ])}
      />
    </>
  );
}

function MaintenanceReport({ items }: { items: any[] }) {
  const today = new Date();
  const in30 = new Date(today);
  in30.setDate(today.getDate() + 30);

  const upcoming = items.filter((m) => {
    if (!m.next_service_date) return false;
    const d = new Date(m.next_service_date + 'T00:00:00');
    return d >= today && d <= in30;
  }).length;

  const overdue = items.filter((m) => {
    if (!m.next_service_date) return false;
    return new Date(m.next_service_date + 'T00:00:00') < today;
  }).length;

  const totalCost = items.reduce((s, m) => s + (m.total_cost || 0), 0);

  const byVehicle = Object.values(
    items.reduce((m: any, r) => {
      const key = r.vehicle_number || 'Unknown';
      if (!m[key]) m[key] = { vehicle: key, cost: 0 };
      m[key].cost += r.total_cost || 0;
      return m;
    }, {})
  ).sort((a: any, b: any) => b.cost - a.cost).slice(0, 12) as any[];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="Total Records" value={String(items.length)} />
        <KPI label="Total Cost" value={inr(totalCost)} />
        <KPI label="Upcoming (30 days)" value={String(upcoming)} sub="Services due soon" />
        <KPI label="Overdue Services" value={String(overdue)} sub="Past next service date" />
      </div>
      <div className="mb-5">
        <SectionLabel>Maintenance Cost by Vehicle</SectionLabel>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byVehicle} barSize={30}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="vehicle" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => [inr(v), 'Cost']} />
            <Bar dataKey="cost" fill="#6b7280" radius={[4, 4, 0, 0]} name="Total Cost" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ReportTable
        headers={['Vehicle', 'Type', 'Service', 'Date', 'Next Due', 'Parts Cost', 'Labour Cost', 'Total Cost', 'Vendor', 'Status']}
        rows={items.map((m) => [
          m.vehicle_number, m.maintenance_type, m.service_type || '—',
          m.service_date ? new Date(m.service_date + 'T00:00:00').toLocaleDateString('en-IN') : '—',
          m.next_service_date ? new Date(m.next_service_date + 'T00:00:00').toLocaleDateString('en-IN') : '—',
          inr(m.parts_cost), inr(m.labor_cost), inr(m.total_cost), m.vendor_name || '—', m.status || '—',
        ])}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report card definitions
// ─────────────────────────────────────────────────────────────────────────────
interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permission: string;
}

const reportCards: ReportCard[] = [
  { id: 'auditor-report', title: 'Auditor Report', description: 'Full audit — P&L, payment methods, GST, receivables, TDS & ledger', icon: <ShieldCheck size={24} />, color: 'bg-indigo-100 text-indigo-600', permission: 'finance:read' },
  { id: 'trip-summary', title: 'Trip Summary', description: 'Overview of all trips with completion rates, distances, and timelines', icon: <MapPin size={24} />, color: 'bg-blue-100 text-blue-600', permission: 'reports:read' },
  { id: 'vehicle-performance', title: 'Vehicle Performance', description: 'Vehicle utilization, mileage analysis, and operational efficiency', icon: <Truck size={24} />, color: 'bg-green-100 text-green-600', permission: 'reports:read' },
  { id: 'driver-performance', title: 'Driver Performance', description: 'Driver ratings, trip counts, on-time delivery, and safety metrics', icon: <Users size={24} />, color: 'bg-purple-100 text-purple-600', permission: 'reports:read' },
  { id: 'fuel-analysis', title: 'Fuel Analysis', description: 'Fuel consumption trends, cost per km, and efficiency comparisons', icon: <Fuel size={24} />, color: 'bg-orange-100 text-orange-600', permission: 'reports:read' },
  { id: 'revenue-analysis', title: 'Revenue Analysis', description: 'Revenue trends by month with collection and outstanding breakdown', icon: <DollarSign size={24} />, color: 'bg-emerald-100 text-emerald-600', permission: 'finance:read' },
  { id: 'expense-analysis', title: 'Expense Analysis', description: 'Detailed expense breakdown by category with approval status', icon: <TrendingUp size={24} />, color: 'bg-red-100 text-red-600', permission: 'finance:read' },
  { id: 'route-analysis', title: 'Route Analysis', description: 'Route profitability, frequency, and optimization insights', icon: <MapPin size={24} />, color: 'bg-cyan-100 text-cyan-600', permission: 'reports:read' },
  { id: 'client-outstanding', title: 'Client Outstanding', description: 'Outstanding receivables by client with overdue aging analysis', icon: <Building2 size={24} />, color: 'bg-amber-100 text-amber-600', permission: 'finance:read' },
  { id: 'maintenance', title: 'Maintenance Report', description: 'Vehicle maintenance history, costs, and upcoming schedules', icon: <Wrench size={24} />, color: 'bg-gray-100 text-gray-600', permission: 'vehicles:read' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────
const PERIODS: { label: string; value: Period }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
  { label: 'Custom', value: 'custom' },
];

export default function ReportsPage() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(() => {
    if (period === 'custom') return { from: customFrom, to: customTo };
    return periodDates(period);
  }, [period, customFrom, customTo]);

  const { data: reportRaw, isLoading } = useQuery({
    queryKey: ['report', selectedReport, dateRange],
    queryFn: () => {
      if (!selectedReport || selectedReport === 'auditor-report') return null;
      const p = dateRange as any;
      switch (selectedReport) {
        case 'trip-summary': return reportService.tripSummary(p);
        case 'vehicle-performance': return reportService.vehiclePerformance(p);
        case 'driver-performance': return reportService.driverPerformance(p);
        case 'fuel-analysis': return reportService.fuelAnalysis(p);
        case 'revenue-analysis': return reportService.revenueAnalysis(p);
        case 'expense-analysis': return reportService.expenseAnalysis(p);
        case 'route-analysis': return reportService.routeAnalysis(p);
        case 'client-outstanding': return reportService.clientOutstanding(p);
        case 'maintenance': return (reportService as any).maintenanceReport(p);
        default: return null;
      }
    },
    enabled: !!selectedReport && selectedReport !== 'auditor-report',
  });

  // Unwrap APIResponse { success, data } or plain array
  const reportItems: any[] = Array.isArray((reportRaw as any)?.data)
    ? (reportRaw as any).data
    : Array.isArray(reportRaw)
    ? (reportRaw as any[])
    : [];

  const { data: dashboardSummary } = useQuery({
    queryKey: ['reports-dashboard-summary'],
    queryFn: reportService.dashboard,
  });

  const handleExport = async (format: string) => {
    if (!selectedReport) return;
    try {
      const blob = await reportService.exportReport(selectedReport, format, dateRange as any);
      const url = URL.createObjectURL(new Blob([blob as any]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  const visibleReports = reportCards.filter((r) => hasPermission(r.permission));
  const cardInfo = reportCards.find((r) => r.id === selectedReport);

  const handleReportClick = (id: string) => {
    if (id === 'auditor-report') { navigate('/reports/auditor'); return; }
    setSelectedReport(id);
  };

  const renderReport = () => {
    if (isLoading) return <Spinner />;
    if (!reportItems.length) return <Empty />;
    switch (selectedReport) {
      case 'trip-summary': return <TripSummaryReport items={reportItems} />;
      case 'vehicle-performance': return <VehiclePerformanceReport items={reportItems} />;
      case 'driver-performance': return <DriverPerformanceReport items={reportItems} />;
      case 'fuel-analysis': return <FuelAnalysisReport items={reportItems} />;
      case 'revenue-analysis': return <RevenueAnalysisReport items={reportItems} />;
      case 'expense-analysis': return <ExpenseAnalysisReport items={reportItems} />;
      case 'route-analysis': return <RouteAnalysisReport items={reportItems} />;
      case 'client-outstanding': return <ClientOutstandingReport items={reportItems} />;
      case 'maintenance': return <MaintenanceReport items={reportItems} />;
      default: return <Empty />;
    }
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Generate detailed reports and insights</p>
          {dashboardSummary && (
            <p className="text-xs text-gray-500 mt-1">
              Jobs: {(dashboardSummary as any).jobs?.total ?? 0} | Trips: {(dashboardSummary as any).trips?.total ?? 0} | LR: {(dashboardSummary as any).lr?.total ?? 0}
            </p>
          )}
        </div>
      </div>

      {/* Report grid */}
      {!selectedReport ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleReportClick(report.id)}
              className="card text-left hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl ${report.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                {report.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
              <p className="text-sm text-gray-500">{report.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setSelectedReport(null)}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h2 className="font-bold text-gray-900 text-lg">{cardInfo?.title}</h2>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Period preset buttons */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      period === p.value ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Custom date inputs */}
              {period === 'custom' && (
                <>
                  <input type="date" className="input-field w-36 text-sm" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  <span className="text-gray-400 text-sm">to</span>
                  <input type="date" className="input-field w-36 text-sm" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </>
              )}
              {/* Date label for presets */}
              {period !== 'custom' && dateRange.from && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(dateRange.from + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  {' – '}
                  {new Date(dateRange.to + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
              {/* Export */}
              <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3">
                <FileSpreadsheet size={14} /> CSV
              </button>
              <button onClick={() => handleExport('pdf')} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3">
                <Download size={14} /> PDF
              </button>
            </div>
          </div>

          {/* Report content */}
          <div className="card">{renderReport()}</div>
        </div>
      )}
    </div>
  );
}
