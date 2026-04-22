/**
 * PumpOperatorsPage — Admin/Fleet Manager view of all pump operators
 * Shows: operator list, today's attendance status, monthly attendance %, today's fuel summary
 * Drill-down: click operator → day-by-day fuel log + attendance calendar
 * Data sourced from what pump operators fill in the mobile app.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Fuel, Calendar, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Droplets, IndianRupee, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '@/services/api';
import { fuelPumpService } from '@/services/fuelPumpService';

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

export default function PumpOperatorsPage() {
  const [selectedOperator, setSelectedOperator] = useState<any>(null);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button
          onClick={() => setSelectedOperator(null)}
          className="hover:text-orange-600 font-medium"
        >
          Pump Operators
        </button>
        {selectedOperator && (
          <>
            <ChevronRight size={14} />
            <span className="text-gray-700 font-medium">{selectedOperator.first_name} {selectedOperator.last_name}</span>
          </>
        )}
      </div>

      {!selectedOperator ? (
        <OperatorListView onSelectOperator={setSelectedOperator} />
      ) : (
        <OperatorDetailView operator={selectedOperator} onBack={() => setSelectedOperator(null)} />
      )}
    </div>
  );
}

// ─── Operator list ─────────────────────────────────────────────────────
function OperatorListView({ onSelectOperator }: { onSelectOperator: (op: any) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [attendanceMonth, setAttendanceMonth] = useState(currentMonth);
  const [expandedOperator, setExpandedOperator] = useState<any>(null);

  const { data: operatorsData, isLoading } = useQuery({
    queryKey: ['pump-operators'],
    queryFn: () => fuelPumpService.getPumpOperators(),
  });
  const { data: attendanceData } = useQuery({
    queryKey: ['admin-attendance-today', today],
    queryFn: async () => {
      const res = await api.get('/attendance', { params: { date: today, limit: 200 } });
      return res;
    },
  });
  const { data: todayIssuesData } = useQuery({
    queryKey: ['fuel-issues-today', today],
    queryFn: () => fuelPumpService.getIssues({ date_from: today, date_to: today, limit: 500 }),
  });
  const { data: monthlyAttendanceData } = useQuery({
    queryKey: ['pump-operator-attendance', expandedOperator?.id, attendanceMonth],
    queryFn: () => fuelPumpService.getPumpOperatorAttendance(expandedOperator!.id, attendanceMonth),
    enabled: !!expandedOperator,
  });

  const operators: any[] = (operatorsData as any)?.data ?? [];
  const attendanceRecords: any[] = (attendanceData as any)?.data?.items ?? [];
  const attendanceByUserId = new Map<number, any>();
  attendanceRecords.forEach((r: any) => { if (r.user_id) attendanceByUserId.set(Number(r.user_id), r); });

  const issueItems: any[] = (todayIssuesData as any)?.data ?? [];
  const issuesByOperator = new Map<number, { litres: number; amount: number; count: number }>();
  issueItems.forEach((issue: any) => {
    const uid = Number(issue.issued_by_id || issue.issued_by || 0);
    if (!uid) return;
    const cur = issuesByOperator.get(uid) ?? { litres: 0, amount: 0, count: 0 };
    issuesByOperator.set(uid, { litres: cur.litres + Number(issue.quantity_litres ?? issue.litres ?? 0), amount: cur.amount + Number(issue.total_amount ?? issue.amount ?? 0), count: cur.count + 1 });
  });

  const monthlyData = (monthlyAttendanceData as any)?.data;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pump Operators</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live attendance & fuel activity — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard icon={<Users className="text-blue-600" size={20} />} label="Total Operators" value={operators.length} color="bg-blue-50" />
        <KPICard icon={<CheckCircle className="text-green-600" size={20} />} label="Checked In Today" value={operators.filter(op => attendanceByUserId.has(op.id)).length} color="bg-green-50" />
        <KPICard icon={<Fuel className="text-orange-600" size={20} />} label="Fuel Issued Today" value={`${[...issuesByOperator.values()].reduce((s, v) => s + v.litres, 0).toFixed(0)} L`} color="bg-orange-50" />
        <KPICard icon={<IndianRupee className="text-purple-600" size={20} />} label="Today's Value" value={`₹${[...issuesByOperator.values()].reduce((s, v) => s + v.amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="bg-purple-50" />
      </div>

      {/* Operator list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">All Pump Operators</h2>
          <span className="text-xs text-gray-400">{operators.length} total</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
          </div>
        ) : operators.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No pump operators found</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {operators.map((op: any) => {
              const attendance = attendanceByUserId.get(op.id);
              const fuelToday = issuesByOperator.get(op.id);
              const isExpanded = expanded === op.id;

              return (
                <div key={op.id}>
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-orange-600 text-sm">{(op.first_name || op.name || 'P')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{op.first_name} {op.last_name}</p>
                      <p className="text-xs text-gray-500">{op.email} · {op.phone || '—'}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {attendance ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <CheckCircle size={12} />
                          {attendance.status === 'late' ? 'Late' : 'Checked In'}
                          {attendance.check_in_time && (
                            <span className="font-normal">&nbsp;{new Date(attendance.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                          <XCircle size={12} /> Not Checked In
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:block text-right flex-shrink-0 min-w-[90px]">
                      {fuelToday ? (
                        <><p className="text-sm font-bold text-orange-600">{fuelToday.litres.toFixed(0)} L</p><p className="text-xs text-gray-400">{fuelToday.count} issues</p></>
                      ) : <p className="text-xs text-gray-400">No fuel today</p>}
                    </div>
                    {/* View details button */}
                    <button
                      onClick={() => onSelectOperator(op)}
                      className="px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 flex-shrink-0"
                    >
                      Day-by-Day
                    </button>
                    <button
                      onClick={() => { const next = isExpanded ? null : op.id; setExpanded(next); if (next) setExpandedOperator(op); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {/* Quick expand panel */}
                  {isExpanded && (
                    <div className="px-5 pb-5 bg-gray-50 border-t border-gray-100 space-y-4">
                      {attendance?.check_in_photo_url && (
                        <div className="flex items-center gap-4 pt-3">
                          <img src={attendance.check_in_photo_url} alt="Attendance selfie" className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-sm" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Attendance Selfie</p>
                            <p className="text-xs text-gray-500">{new Date(attendance.check_in_time).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Calendar size={14} /> Monthly Attendance</p>
                          <input type="month" value={attendanceMonth} onChange={e => setAttendanceMonth(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-400 outline-none" />
                        </div>
                        {monthlyData ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <MiniStat label="Working Days" value={monthlyData.summary?.working_days ?? '—'} />
                            <MiniStat label="Present" value={monthlyData.summary?.present_days ?? '—'} color="text-green-600" />
                            <MiniStat label="Late" value={monthlyData.summary?.late_days ?? '—'} color="text-yellow-600" />
                            <MiniStat label="Attendance %" value={monthlyData.summary?.attendance_pct != null ? `${monthlyData.summary.attendance_pct}%` : '—'} color="text-blue-600" />
                          </div>
                        ) : <p className="text-xs text-gray-400">Loading...</p>}
                      </div>
                      {fuelToday && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2"><Droplets size={14} /> Today's Fuel Issues</p>
                          <div className="grid grid-cols-3 gap-3">
                            <MiniStat label="Litres Issued" value={`${fuelToday.litres.toFixed(1)} L`} color="text-orange-600" />
                            <MiniStat label="Transactions" value={fuelToday.count} />
                            <MiniStat label="Total Value" value={`₹${fuelToday.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-purple-600" />
                          </div>
                        </div>
                      )}
                      {monthlyData?.attendance_log?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2"><Clock size={14} /> Daily Log — {attendanceMonth}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {monthlyData.attendance_log.map((log: any) => {
                              const d = new Date(log.date);
                              const label = d.toLocaleDateString('en-IN', { day: 'numeric' });
                              const statusColors: Record<string, string> = { present: 'bg-green-500', late: 'bg-yellow-400', absent: 'bg-red-400', weekend: 'bg-gray-200', holiday: 'bg-blue-200' };
                              const color = statusColors[log.status] ?? 'bg-gray-300';
                              return (
                                <div key={log.date} title={`${log.date} — ${log.status}${log.check_in_time ? ' at ' + new Date(log.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}`} className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${color} cursor-default`}>
                                  {label}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-3 mt-2 flex-wrap">
                            {[{ label: 'Present', color: 'bg-green-500' }, { label: 'Late', color: 'bg-yellow-400' }, { label: 'Absent', color: 'bg-red-400' }, { label: 'Weekend', color: 'bg-gray-200' }].map(s => (
                              <span key={s.label} className="flex items-center gap-1 text-[10px] text-gray-500"><span className={`w-3 h-3 rounded ${s.color} inline-block`} /> {s.label}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Operator day-by-day detail ────────────────────────────────────────
function OperatorDetailView({ operator, onBack }: { operator: any; onBack: () => void }) {
  const [operatorDate, setOperatorDate] = useState(today);
  const [operatorMonth, setOperatorMonth] = useState(currentMonth);

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
  const dayTotal = issuesDay.reduce((s: number, i: any) => s + Number(i.quantity_litres ?? i.litres ?? 0), 0);
  const dayAmount = issuesDay.reduce((s: number, i: any) => s + Number(i.total_amount ?? i.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600">
        <ChevronLeft size={16} /> Back to Operator List
      </button>

      {/* Operator card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
          <span className="font-bold text-orange-600 text-xl">{(operator.first_name || 'P')[0].toUpperCase()}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{operator.first_name} {operator.last_name}</h2>
          <p className="text-sm text-gray-500">{operator.email} · {operator.phone || '—'}</p>
        </div>
      </div>

      {/* Monthly attendance */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} /> Monthly Attendance</h3>
          <input type="month" value={operatorMonth} onChange={e => setOperatorMonth(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-400 outline-none" />
        </div>
        {monthlyData?.summary ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <MiniStat label="Working Days" value={monthlyData.summary.working_days ?? '—'} />
              <MiniStat label="Present" value={monthlyData.summary.present_days ?? '—'} color="text-green-600" />
              <MiniStat label="Late" value={monthlyData.summary.late_days ?? '—'} color="text-yellow-600" />
              <MiniStat label="Attendance %" value={monthlyData.summary.attendance_pct != null ? `${monthlyData.summary.attendance_pct}%` : '—'} color="text-blue-600" />
            </div>
            {monthlyData.attendance_log?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Click a day to see that day's fuel log</p>
                <div className="flex flex-wrap gap-1.5">
                  {monthlyData.attendance_log.map((log: any) => {
                    const d = new Date(log.date);
                    const label = d.toLocaleDateString('en-IN', { day: 'numeric' });
                    const colors: Record<string, string> = { present: 'bg-green-500', late: 'bg-yellow-400', absent: 'bg-red-400', weekend: 'bg-gray-200', holiday: 'bg-blue-200' };
                    const isSelected = log.date === operatorDate;
                    return (
                      <button key={log.date} title={`${log.date} — ${log.status}`} onClick={() => setOperatorDate(log.date)} className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold text-white ${colors[log.status] ?? 'bg-gray-300'} ${isSelected ? 'ring-2 ring-offset-1 ring-orange-500' : ''}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {[{ label: 'Present', color: 'bg-green-500' }, { label: 'Late', color: 'bg-yellow-400' }, { label: 'Absent', color: 'bg-red-400' }, { label: 'Weekend', color: 'bg-gray-200' }].map(s => (
                    <span key={s.label} className="flex items-center gap-1 text-[10px] text-gray-500"><span className={`w-3 h-3 rounded ${s.color}`} /> {s.label}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : <p className="text-sm text-gray-400">Loading...</p>}
      </div>

      {/* Day fuel log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Fuel size={16} /> Fuel Log — {new Date(operatorDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <input type="date" value={operatorDate} max={today} onChange={e => setOperatorDate(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-400 outline-none" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniStat label="Litres Issued" value={`${dayTotal.toFixed(1)} L`} color="text-orange-600" />
          <MiniStat label="Transactions" value={issuesDay.length} />
          <MiniStat label="Value" value={`₹${dayAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-purple-600" />
        </div>
        {issuesDay.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">No fuel issued on this date</p>
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

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className={`${color} rounded-xl border border-gray-200 p-4`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500 font-medium">{label}</span></div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
function MiniStat({ label, value, color = 'text-gray-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
