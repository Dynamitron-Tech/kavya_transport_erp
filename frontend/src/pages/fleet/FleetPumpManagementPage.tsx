/**
 * FleetPumpManagementPage — mirrors the app's Pump Management section
 * Fleet manager can: view all bunks, tanks, pumps, pump employees, attendance, fuel logs
 * and also issue fuel / add stock directly from the website.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Fuel, Users, ChevronRight, ChevronLeft, Droplets, IndianRupee,
  CheckCircle, XCircle, Clock, Plus, BarChart2, RefreshCw, Layers,
  Calendar, ChevronDown, ChevronUp, Building2, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fuelPumpService } from '@/services/fuelPumpService';
import api from '@/services/api';

type View = 'bunks' | 'bunk-detail' | 'employees' | 'operator-detail';

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

// ── helper: build last N days array ────────────────────────────────────────
function lastNDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  }).reverse();
}

export default function FleetPumpManagementPage() {
  const [view, setView] = useState<View>('bunks');
  const [selectedBunk, setSelectedBunk] = useState<any>(null);
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [bunkTab, setBunkTab] = useState<'tanks' | 'pumps' | 'employees' | 'log'>('tanks');
  const [operatorDate, setOperatorDate] = useState(today);
  const [operatorMonth, setOperatorMonth] = useState(currentMonth);
  const [showIssueFuel, setShowIssueFuel] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button
          onClick={() => { setView('bunks'); setSelectedBunk(null); setSelectedOperator(null); }}
          className="hover:text-orange-600 font-medium"
        >
          Pump Management
        </button>
        {selectedBunk && (
          <>
            <ChevronRight size={14} />
            <button
              onClick={() => { setView('bunk-detail'); setSelectedOperator(null); }}
              className="hover:text-orange-600 font-medium"
            >
              {selectedBunk.name}
            </button>
          </>
        )}
        {selectedOperator && (
          <>
            <ChevronRight size={14} />
            <span className="text-gray-700 font-medium">
              {selectedOperator.first_name} {selectedOperator.last_name}
            </span>
          </>
        )}
      </div>

      {view === 'bunks' && (
        <BunkListView
          onSelectBunk={(bunk) => { setSelectedBunk(bunk); setView('bunk-detail'); setBunkTab('tanks'); }}
        />
      )}
      {view === 'bunk-detail' && selectedBunk && (
        <BunkDetailView
          bunk={selectedBunk}
          tab={bunkTab}
          onTabChange={setBunkTab}
          onSelectOperator={(op: any) => { setSelectedOperator(op); setView('operator-detail'); }}
          showIssueFuel={showIssueFuel}
          setShowIssueFuel={setShowIssueFuel}
          showAddStock={showAddStock}
          setShowAddStock={setShowAddStock}
        />
      )}
      {view === 'operator-detail' && selectedOperator && selectedBunk && (
        <OperatorDetailView
          operator={selectedOperator}
          bunk={selectedBunk}
          operatorDate={operatorDate}
          setOperatorDate={setOperatorDate}
          operatorMonth={operatorMonth}
          setOperatorMonth={setOperatorMonth}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BUNK LIST VIEW  (mirrors app: list of branches with tank totals)
// ═══════════════════════════════════════════════════════════════════════
function BunkListView({ onSelectBunk }: { onSelectBunk: (b: any) => void }) {
  const { data: branchData, isLoading } = useQuery({
    queryKey: ['fuel-branches'],
    queryFn: fuelPumpService.getBranches,
  });
  const { data: allTanksData } = useQuery({
    queryKey: ['fuel-tanks-all'],
    queryFn: fuelPumpService.getTanks,
  });

  const branches: any[] = (branchData as any)?.data ?? [];
  const allTanks: any[] = (allTanksData as any)?.data ?? [];

  // Group tanks by branch
  const tanksByBranch = new Map<number, any[]>();
  allTanks.forEach(t => {
    const key = t.branch_id ?? 0;
    if (!tanksByBranch.has(key)) tanksByBranch.set(key, []);
    tanksByBranch.get(key)!.push(t);
  });

  // Summary KPIs
  const totalStock = allTanks.reduce((s, t) => s + (t.current_stock_litres ?? 0), 0);
  const totalCapacity = allTanks.reduce((s, t) => s + (t.capacity_litres ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pump Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Select a bunk to manage tanks, pumps and employees</p>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKPI icon={<Building2 size={18} className="text-blue-600" />} label="Total Bunks" value={branches.length} bg="bg-blue-50" />
        <MiniKPI icon={<Layers size={18} className="text-orange-600" />} label="Total Tanks" value={allTanks.length} bg="bg-orange-50" />
        <MiniKPI icon={<Droplets size={18} className="text-green-600" />} label="Total Stock" value={`${totalStock.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`} bg="bg-green-50" />
        <MiniKPI icon={<Activity size={18} className="text-purple-600" />} label="Capacity" value={`${totalCapacity.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`} bg="bg-purple-50" />
      </div>

      {isLoading ? (
        <Spinner />
      ) : branches.length === 0 ? (
        <Empty msg="No bunks found" />
      ) : (
        <div className="space-y-3">
          {branches.map((branch: any) => {
            const tanks = tanksByBranch.get(branch.id) ?? [];
            const stock = tanks.reduce((s, t) => s + (t.current_stock_litres ?? 0), 0);
            const capacity = tanks.reduce((s, t) => s + (t.capacity_litres ?? 0), 0);
            const pct = capacity > 0 ? (stock / capacity) * 100 : 0;
            const barColor = pct > 60 ? 'bg-blue-500' : pct > 30 ? 'bg-orange-400' : 'bg-red-500';

            return (
              <button
                key={branch.id}
                onClick={() => onSelectBunk(branch)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-orange-300 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Fuel size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-900">{branch.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{tanks.length} Tanks</span>
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-orange-500" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{branch.city}</p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${pct > 60 ? 'text-blue-600' : pct > 30 ? 'text-orange-500' : 'text-red-500'}`}>
                          {stock.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L
                        </span>
                        <span className="text-xs text-gray-400">/ {capacity.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BUNK DETAIL VIEW  (Tanks / Pumps / Employees / Log tabs)
// ═══════════════════════════════════════════════════════════════════════
function BunkDetailView({
  bunk, tab, onTabChange, onSelectOperator,
  showIssueFuel, setShowIssueFuel, showAddStock, setShowAddStock,
}: any) {
  const qc = useQueryClient();

  const { data: tanksData, isLoading: tanksLoading } = useQuery({
    queryKey: ['tanks-branch', bunk.id],
    queryFn: () => fuelPumpService.getTanksByBranch(bunk.id),
  });
  const { data: pumpsData } = useQuery({
    queryKey: ['pumps-branch', bunk.id],
    queryFn: () => fuelPumpService.getPumps(bunk.id),
  });
  const { data: operatorsData } = useQuery({
    queryKey: ['pump-operators'],
    queryFn: fuelPumpService.getPumpOperators,
  });
  // Today attendance for all (we'll filter by bunk via branch_id)
  const { data: attendanceData } = useQuery({
    queryKey: ['admin-attendance-today', today],
    queryFn: () => api.get('/attendance', { params: { date: today, limit: 200 } }),
  });
  // Today's fuel issues for this bunk
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ['fuel-issues-bunk', bunk.id, today],
    queryFn: () => fuelPumpService.getIssuesByDateRange(today, today, bunk.id),
  });

  const tanks: any[] = (tanksData as any)?.data ?? [];
  const pumps: any[] = (pumpsData as any)?.data ?? [];
  const allOperators: any[] = (operatorsData as any)?.data ?? [];
  // Filter operators for this bunk (those assigned to this branch)
  const operators = allOperators.filter(op => op.branch_id === bunk.id || allOperators.length <= 3);
  const attendanceRecords: any[] = (attendanceData as any)?.data?.items ?? [];
  const attendanceByUserId = new Map(attendanceRecords.map((r: any) => [Number(r.user_id), r]));
  const issues: any[] = (issuesData as any)?.data ?? [];

  const totalStock = tanks.reduce((s, t) => s + (t.current_stock_litres ?? 0), 0);
  const todayLitres = issues.reduce((s, i) => s + Number(i.quantity_litres ?? i.litres ?? 0), 0);
  const todayAmount = issues.reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);
  const checkedIn = operators.filter(op => attendanceByUserId.has(op.id)).length;

  const TABS = ['tanks', 'pumps', 'employees', 'log'] as const;
  const TAB_LABELS: Record<string, string> = { tanks: 'Tanks', pumps: 'Pumps', employees: 'Employees', log: 'Fuel Log' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{bunk.name}</h1>
          <p className="text-sm text-gray-500">{bunk.city}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw size={14} /> Add Stock
          </button>
          <button
            onClick={() => setShowIssueFuel(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Plus size={14} /> Issue Fuel
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKPI icon={<Droplets size={16} className="text-blue-600" />} label="Total Stock" value={`${totalStock.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`} bg="bg-blue-50" />
        <MiniKPI icon={<Fuel size={16} className="text-orange-600" />} label="Issued Today" value={`${todayLitres.toFixed(1)} L`} bg="bg-orange-50" />
        <MiniKPI icon={<IndianRupee size={16} className="text-purple-600" />} label="Today Value" value={`₹${todayAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} bg="bg-purple-50" />
        <MiniKPI icon={<Users size={16} className="text-green-600" />} label="Checked In" value={`${checkedIn}/${operators.length}`} bg="bg-green-50" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${tab === t ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'tanks' && (
        <TanksTab tanks={tanks} isLoading={tanksLoading} bunk={bunk} onRefresh={() => qc.invalidateQueries({ queryKey: ['tanks-branch', bunk.id] })} />
      )}
      {tab === 'pumps' && (
        <PumpsTab pumps={pumps} tanks={tanks} bunk={bunk} onRefresh={() => qc.invalidateQueries({ queryKey: ['pumps-branch', bunk.id] })} />
      )}
      {tab === 'employees' && (
        <EmployeesTab operators={operators} attendanceByUserId={attendanceByUserId} issues={issues} onSelect={onSelectOperator} />
      )}
      {tab === 'log' && (
        <FuelLogTab issues={issues} isLoading={issuesLoading} bunk={bunk} />
      )}

      {/* Modals */}
      {showIssueFuel && (
        <IssueFuelModal tanks={tanks} bunk={bunk} onClose={() => { setShowIssueFuel(false); qc.invalidateQueries({ queryKey: ['fuel-issues-bunk', bunk.id, today] }); }} />
      )}
      {showAddStock && (
        <AddStockModal tanks={tanks} bunk={bunk} onClose={() => { setShowAddStock(false); qc.invalidateQueries({ queryKey: ['tanks-branch', bunk.id] }); }} />
      )}
    </div>
  );
}

// ── Tanks Tab ──────────────────────────────────────────────────────────
function TanksTab({ tanks, isLoading, bunk, onRefresh }: any) {
  if (isLoading) return <Spinner />;
  if (!tanks.length) return <Empty msg="No tanks at this bunk" />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tanks.map((tank: any) => {
        const pct = tank.capacity_litres > 0 ? (tank.current_stock_litres / tank.capacity_litres) * 100 : 0;
        const barColor = pct > 60 ? 'bg-blue-500' : pct > 30 ? 'bg-orange-400' : 'bg-red-500';
        return (
          <div key={tank.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-gray-900">{tank.name}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tank.fuel_type === 'diesel' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {(tank.fuel_type ?? 'diesel').toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <p className={`text-xl font-bold ${pct > 60 ? 'text-blue-600' : pct > 30 ? 'text-orange-500' : 'text-red-500'}`}>
                  {(tank.current_stock_litres ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} L
                </p>
                <p className="text-xs text-gray-400">of {(tank.capacity_litres ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} L</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{pct.toFixed(0)}% full</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Pumps Tab ──────────────────────────────────────────────────────────
function PumpsTab({ pumps, tanks, bunk, onRefresh }: any) {
  const tankMap = new Map<number, any>(tanks.map((t: any) => [t.id, t]));
  if (!pumps.length) return <Empty msg="No pumps at this bunk" />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {pumps.map((pump: any) => {
        const tank = tankMap.get(pump.tank_id);
        return (
          <div key={pump.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Fuel size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{pump.name || `Pump ${pump.pump_number}`}</p>
                <p className="text-xs text-gray-500">Nozzle #{pump.pump_number}</p>
              </div>
            </div>
            {tank && (
              <p className="text-xs text-gray-500">Tank: {tank.name} · {(tank.fuel_type ?? '').toUpperCase()}</p>
            )}
            <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${pump.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {pump.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Employees Tab ──────────────────────────────────────────────────────
function EmployeesTab({ operators, attendanceByUserId, issues, onSelect }: any) {
  const issuesByOperator = new Map<number, { litres: number; count: number }>();
  issues.forEach((i: any) => {
    const uid = Number(i.issued_by_id || i.issued_by || 0);
    if (!uid) return;
    const cur = issuesByOperator.get(uid) ?? { litres: 0, count: 0 };
    issuesByOperator.set(uid, { litres: cur.litres + Number(i.quantity_litres ?? i.litres ?? 0), count: cur.count + 1 });
  });

  if (!operators.length) return <Empty msg="No pump employees assigned to this bunk" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-100">
        {operators.map((op: any) => {
          const attendance = attendanceByUserId.get(op.id);
          const fuel = issuesByOperator.get(op.id);
          return (
            <div key={op.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-teal-700 text-sm">{(op.first_name || 'P')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{op.first_name} {op.last_name}</p>
                <p className="text-xs text-gray-500">{op.phone || op.email || '—'}</p>
              </div>
              {attendance ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1 flex-shrink-0">
                  <CheckCircle size={11} />
                  {attendance.status === 'late' ? 'Late' : 'Present'}
                  <span className="font-normal">&nbsp;{new Date(attendance.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 flex items-center gap-1 flex-shrink-0">
                  <XCircle size={11} /> Absent
                </span>
              )}
              {fuel ? (
                <div className="hidden sm:block text-right flex-shrink-0 min-w-[70px]">
                  <p className="text-sm font-bold text-orange-600">{fuel.litres.toFixed(1)} L</p>
                  <p className="text-xs text-gray-400">{fuel.count} issues</p>
                </div>
              ) : (
                <p className="hidden sm:block text-xs text-gray-400 min-w-[70px] text-right">No fuel today</p>
              )}
              <button
                onClick={() => onSelect(op)}
                className="px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 flex-shrink-0"
              >
                Details
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fuel Log Tab ───────────────────────────────────────────────────────
function FuelLogTab({ issues, isLoading, bunk }: any) {
  const [dateFilter, setDateFilter] = useState(today);

  const { data: filteredData, isLoading: filterLoading } = useQuery({
    queryKey: ['fuel-issues-bunk-date', bunk.id, dateFilter],
    queryFn: () => fuelPumpService.getIssuesByDateRange(dateFilter, dateFilter, bunk.id),
  });
  const items: any[] = (filteredData as any)?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Fuel Issues</p>
        <input
          type="date"
          value={dateFilter}
          max={today}
          onChange={e => setDateFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-400 outline-none"
        />
      </div>
      {filterLoading ? <Spinner /> : items.length === 0 ? <Empty msg="No fuel issues on this date" /> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5">Vehicle</th>
                  <th className="text-left px-4 py-2.5">Driver</th>
                  <th className="text-right px-4 py-2.5">Litres</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="text-left px-4 py-2.5">Time</th>
                  <th className="text-left px-4 py-2.5">Issued By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((issue: any) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{issue.vehicle_registration || issue.external_vehicle_number || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{issue.driver_name || issue.driver?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-orange-600">{Number(issue.quantity_litres ?? issue.litres ?? 0).toFixed(1)} L</td>
                    <td className="px-4 py-2.5 text-right text-purple-700">₹{Number(issue.total_amount ?? issue.amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{issue.issued_at ? new Date(issue.issued_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{issue.issuer_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-orange-50">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-600">Total ({items.length} issues)</td>
                  <td className="px-4 py-2 text-right font-bold text-orange-600">{items.reduce((s: number, i: any) => s + Number(i.quantity_litres ?? i.litres ?? 0), 0).toFixed(1)} L</td>
                  <td className="px-4 py-2 text-right font-bold text-purple-700">₹{items.reduce((s: number, i: any) => s + Number(i.total_amount ?? i.amount ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// OPERATOR DETAIL VIEW  (day-by-day attendance + fuel log)
// ═══════════════════════════════════════════════════════════════════════
function OperatorDetailView({ operator, bunk, operatorDate, setOperatorDate, operatorMonth, setOperatorMonth }: any) {
  const [viewTab, setViewTab] = useState<'today' | 'log' | 'attendance'>('today');
  const days = lastNDays(14);

  const { data: attendanceData } = useQuery({
    queryKey: ['pump-operator-attendance', operator.id, operatorMonth],
    queryFn: () => fuelPumpService.getPumpOperatorAttendance(operator.id, operatorMonth),
  });
  const { data: issuesDayData } = useQuery({
    queryKey: ['pump-operator-issues-day', operator.id, operatorDate],
    queryFn: () => fuelPumpService.getPumpOperatorFuelIssues(operator.id, operatorDate),
  });

  const monthlyData = (attendanceData as any)?.data;
  const allIssuesDay: any[] = (issuesDayData as any)?.data ?? [];
  const issuesDay = allIssuesDay.filter((i: any) => i.issued_by === operator.id);
  const dayTotal = issuesDay.reduce((s, i) => s + Number(i.quantity_litres ?? i.litres ?? 0), 0);
  const dayAmount = issuesDay.reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Operator card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
          <span className="font-bold text-teal-700 text-xl">{(operator.first_name || 'P')[0].toUpperCase()}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{operator.first_name} {operator.last_name}</h2>
          <p className="text-sm text-gray-500">{operator.email} · {operator.phone || '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Bunk: {bunk.name}, {bunk.city}</p>
        </div>
      </div>

      {/* Month attendance summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} /> Monthly Attendance</h3>
          <input
            type="month"
            value={operatorMonth}
            onChange={e => setOperatorMonth(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-400 outline-none"
          />
        </div>
        {monthlyData?.summary ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <MiniKPI label="Working Days" value={monthlyData.summary.working_days ?? '—'} bg="bg-gray-50" />
              <MiniKPI label="Present" value={monthlyData.summary.present_days ?? '—'} bg="bg-green-50" textColor="text-green-700" />
              <MiniKPI label="Late" value={monthlyData.summary.late_days ?? '—'} bg="bg-yellow-50" textColor="text-yellow-700" />
              <MiniKPI label="Attendance %" value={monthlyData.summary.attendance_pct != null ? `${monthlyData.summary.attendance_pct}%` : '—'} bg="bg-blue-50" textColor="text-blue-700" />
            </div>
            {/* Day-by-day calendar dots */}
            {monthlyData.attendance_log?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Daily view</p>
                <div className="flex flex-wrap gap-1.5">
                  {monthlyData.attendance_log.map((log: any) => {
                    const d = new Date(log.date);
                    const label = d.toLocaleDateString('en-IN', { day: 'numeric' });
                    const colors: Record<string, string> = { present: 'bg-green-500', late: 'bg-yellow-400', absent: 'bg-red-400', weekend: 'bg-gray-200', holiday: 'bg-blue-200' };
                    const isSelected = log.date === operatorDate;
                    return (
                      <button
                        key={log.date}
                        title={`${log.date} — ${log.status}`}
                        onClick={() => setOperatorDate(log.date)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold text-white ${colors[log.status] ?? 'bg-gray-300'} ${isSelected ? 'ring-2 ring-offset-1 ring-orange-500' : ''}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {[{ label: 'Present', color: 'bg-green-500' }, { label: 'Late', color: 'bg-yellow-400' }, { label: 'Absent', color: 'bg-red-400' }, { label: 'Weekend', color: 'bg-gray-200' }].map(s => (
                    <span key={s.label} className="flex items-center gap-1 text-[10px] text-gray-500">
                      <span className={`w-3 h-3 rounded ${s.color}`} /> {s.label}
                    </span>
                  ))}
                  <span className="text-[10px] text-gray-400 ml-2">Click a day to see fuel log</span>
                </div>
              </div>
            )}
          </>
        ) : <p className="text-sm text-gray-400">Loading attendance...</p>}
      </div>

      {/* Day fuel detail */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Fuel size={16} /> Fuel Log — {new Date(operatorDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <input
            type="date"
            value={operatorDate}
            max={today}
            onChange={e => setOperatorDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-400 outline-none"
          />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniKPI label="Litres Issued" value={`${dayTotal.toFixed(1)} L`} bg="bg-orange-50" textColor="text-orange-700" />
          <MiniKPI label="Transactions" value={issuesDay.length} bg="bg-gray-50" />
          <MiniKPI label="Value" value={`₹${dayAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} bg="bg-purple-50" textColor="text-purple-700" />
        </div>
        {issuesDay.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No fuel issued on this date</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Vehicle</th>
                  <th className="text-left px-3 py-2">Driver</th>
                  <th className="text-right px-3 py-2">Litres</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Odometer</th>
                  <th className="text-left px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {issuesDay.map((issue: any) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{issue.vehicle_registration || issue.external_vehicle_number || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{issue.driver_name || issue.driver?.name || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-orange-600">{Number(issue.quantity_litres ?? issue.litres ?? 0).toFixed(1)} L</td>
                    <td className="px-3 py-2 text-right text-gray-500">₹{Number(issue.rate_per_litre ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-purple-700">₹{Number(issue.total_amount ?? issue.amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-gray-500">{issue.odometer_reading ? `${Number(issue.odometer_reading).toLocaleString('en-IN')} km` : '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{issue.issued_at ? new Date(issue.issued_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ISSUE FUEL MODAL
// ═══════════════════════════════════════════════════════════════════════
function IssueFuelModal({ tanks, bunk, onClose }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    tank_id: tanks[0]?.id ?? '',
    fuel_type: tanks[0]?.fuel_type ?? 'diesel',
    vehicle_number: '',
    driver_name: '',
    quantity_litres: '',
    rate_per_litre: '89.50',
    odometer_reading: '',
    receipt_number: '',
    remarks: '',
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => api.get('/vehicles', { params: { limit: 200 } }),
  });
  const vehicles: any[] = (vehiclesData as any)?.data ?? [];

  const mutation = useMutation({
    mutationFn: (data: any) => fuelPumpService.issueFuel(data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['fuel-issues-bunk'] });
      qc.invalidateQueries({ queryKey: ['tanks-branch', bunk.id] });
      if (res?.data?.theft_alert) toast.error(`⚠️ Anomaly: ${res.data.theft_alert.description}`, { duration: 8000 });
      else toast.success('Fuel issued successfully');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to issue fuel'),
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal title="Issue Fuel" onClose={onClose}>
      <div className="space-y-3">
        <FormRow label="Tank *">
          <select className={selectCls} value={form.tank_id} onChange={e => f('tank_id', e.target.value)}>
            {tanks.map((t: any) => <option key={t.id} value={t.id}>{t.name} — {t.current_stock_litres != null ? Number(t.current_stock_litres).toFixed(0) : '0'} L</option>)}
          </select>
        </FormRow>
        <FormRow label="Vehicle">
          <select className={selectCls} value={form.vehicle_number} onChange={e => f('vehicle_number', e.target.value)}>
            <option value="">Select vehicle</option>
            {vehicles.map((v: any) => <option key={v.id} value={v.registration_number}>{v.registration_number}</option>)}
          </select>
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Litres *">
            <input className={inputCls} type="number" step="0.1" placeholder="e.g. 50" value={form.quantity_litres} onChange={e => f('quantity_litres', e.target.value)} />
          </FormRow>
          <FormRow label="Rate/L">
            <input className={inputCls} type="number" step="0.01" value={form.rate_per_litre} onChange={e => f('rate_per_litre', e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="Odometer">
          <input className={inputCls} type="number" placeholder="km" value={form.odometer_reading} onChange={e => f('odometer_reading', e.target.value)} />
        </FormRow>
        <FormRow label="Remarks">
          <input className={inputCls} placeholder="Optional" value={form.remarks} onChange={e => f('remarks', e.target.value)} />
        </FormRow>
        <button
          disabled={mutation.isPending || !form.tank_id || !form.quantity_litres}
          onClick={() => mutation.mutate({
            tank_id: Number(form.tank_id),
            fuel_type: form.fuel_type,
            quantity_litres: Number(form.quantity_litres),
            rate_per_litre: Number(form.rate_per_litre),
            odometer_reading: form.odometer_reading ? Number(form.odometer_reading) : null,
            vehicle_number: form.vehicle_number || null,
            remarks: form.remarks || null,
            branch_id: bunk.id,
          })}
          className="w-full py-2.5 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Issuing...' : 'Issue Fuel'}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ADD STOCK MODAL
// ═══════════════════════════════════════════════════════════════════════
function AddStockModal({ tanks, bunk, onClose }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    tank_id: tanks[0]?.id ?? '',
    quantity_litres: '',
    rate_per_litre: '89.50',
    supplier_name: '',
    invoice_number: '',
    remarks: '',
  });

  const mutation = useMutation({
    mutationFn: (data: any) => fuelPumpService.addStock(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tanks-branch', bunk.id] });
      toast.success('Stock added successfully');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to add stock'),
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal title="Add Stock" onClose={onClose}>
      <div className="space-y-3">
        <FormRow label="Tank *">
          <select className={selectCls} value={form.tank_id} onChange={e => f('tank_id', e.target.value)}>
            {tanks.map((t: any) => <option key={t.id} value={t.id}>{t.name} — {t.current_stock_litres != null ? Number(t.current_stock_litres).toFixed(0) : '0'} L</option>)}
          </select>
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Litres *">
            <input className={inputCls} type="number" step="0.1" placeholder="e.g. 2000" value={form.quantity_litres} onChange={e => f('quantity_litres', e.target.value)} />
          </FormRow>
          <FormRow label="Rate/L">
            <input className={inputCls} type="number" step="0.01" value={form.rate_per_litre} onChange={e => f('rate_per_litre', e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="Supplier">
          <input className={inputCls} placeholder="Supplier name" value={form.supplier_name} onChange={e => f('supplier_name', e.target.value)} />
        </FormRow>
        <FormRow label="Invoice #">
          <input className={inputCls} placeholder="Invoice number" value={form.invoice_number} onChange={e => f('invoice_number', e.target.value)} />
        </FormRow>
        <FormRow label="Remarks">
          <input className={inputCls} placeholder="Optional" value={form.remarks} onChange={e => f('remarks', e.target.value)} />
        </FormRow>
        <button
          disabled={mutation.isPending || !form.tank_id || !form.quantity_litres}
          onClick={() => mutation.mutate({
            tank_id: Number(form.tank_id),
            quantity_litres: Number(form.quantity_litres),
            rate_per_litre: Number(form.rate_per_litre),
            supplier_name: form.supplier_name || null,
            invoice_number: form.invoice_number || null,
            remarks: form.remarks || null,
            branch_id: bunk.id,
          })}
          className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Adding...' : 'Add Stock'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none';
const selectCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white';

function MiniKPI({ icon, label, value, bg, textColor }: { icon?: React.ReactNode; label: string; value: string | number; bg: string; textColor?: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 border border-white`}>
      {icon && <div className="mb-1">{icon}</div>}
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${textColor ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" /></div>;
}
function Empty({ msg }: { msg: string }) {
  return <p className="text-center text-gray-400 py-10 text-sm">{msg}</p>;
}
