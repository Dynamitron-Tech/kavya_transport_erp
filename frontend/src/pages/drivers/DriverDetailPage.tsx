// @ts-nocheck
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { driverService } from '@/services/dataService';
import { StatusBadge, LoadingPage } from '@/components/common/Modal';
import type { Driver, DriverTrip, DriverBehaviour, DriverPerformance, DriverDocument, DriverAttendance } from '@/types';
import { safeArray } from '@/utils/helpers';
import {
  ArrowLeft, Edit, Star, ChevronRight, Phone, Mail, MapPin, Calendar,
  Shield, Truck, TrendingUp, FileText, User, Activity, AlertTriangle,
  CheckCircle2, XCircle, Fuel, Gauge, Zap, Eye,
} from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'trips', label: 'Trip History', icon: Truck },
  { key: 'behaviour', label: 'Driving Behaviour', icon: Activity },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'performance', label: 'Performance', icon: TrendingUp },
  { key: 'attendance', label: 'Attendance', icon: Calendar },
];

function InfoRow({ label, value, icon: Icon, className = '' }: { label: string; value: React.ReactNode; icon?: any; className?: string }) {
  return value ? (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 flex items-center gap-1.5">
        {Icon && <Icon size={13} className="text-gray-400" />}{label}
      </span>
      <span className={`text-sm font-medium text-right max-w-[60%] ${className}`}>{value}</span>
    </div>
  ) : null;
}

function ScoreRing({ score, label, size = 80, color }: { score: number; label: string; size?: number; color: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className="text-lg font-bold -mt-[52px]">{score}</span>
      <span className="text-xs text-gray-500 mt-5">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Overview
// ═══════════════════════════════════════════════════════
function OverviewTab({ driver }: { driver: Driver }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Personal Info */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><User size={16} className="text-primary-500" />Personal Information</h3>
        <InfoRow label="Phone" value={driver.phone} icon={Phone} />
        {driver.alternate_phone && <InfoRow label="Alt Phone" value={driver.alternate_phone} icon={Phone} />}
        {driver.email && <InfoRow label="Email" value={driver.email} icon={Mail} />}
        <InfoRow label="Date of Birth" value={driver.date_of_birth ? new Date(driver.date_of_birth).toLocaleDateString('en-IN') : null} icon={Calendar} />
        <InfoRow label="Blood Group" value={driver.blood_group} className="text-red-600 font-semibold" />
        <InfoRow label="Address" value={[driver.address, driver.city, driver.state].filter(Boolean).join(', ')} icon={MapPin} />
        <InfoRow label="Aadhaar" value={driver.aadhaar_number} />
        <InfoRow label="PAN" value={driver.pan_number} />
      </div>

      {/* Employment Info */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Shield size={16} className="text-green-500" />Employment & License</h3>
        <InfoRow label="Employee ID" value={driver.employee_id} />
        <InfoRow label="Designation" value={driver.designation} />
        <InfoRow label="Joining Date" value={new Date(driver.joining_date).toLocaleDateString('en-IN')} icon={Calendar} />
        <InfoRow label="License No." value={<span className="font-mono">{driver.license_number}</span>} />
        <InfoRow label="License Type" value={driver.license_type} />
        <InfoRow label="License Expiry" value={new Date(driver.license_expiry).toLocaleDateString('en-IN')}
          className={new Date(driver.license_expiry) < new Date() ? 'text-red-600' : ''} />
        <InfoRow label="Salary Type" value={driver.salary_type} />
        <InfoRow label="Base Salary" value={`₹${Number((driver.salary_base || 0) ?? 0).toLocaleString('en-IN')}`} />
        {driver.per_km_rate && <InfoRow label="Per KM Rate" value={`₹${driver.per_km_rate}`} />}
        <InfoRow label="Bank" value={driver.bank_name} />
      </div>

      {/* Stats & Emergency */}
      <div className="space-y-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-purple-500" />Statistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-primary-700">{driver.total_trips}</p>
              <p className="text-xs text-primary-500">Total Trips</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{Number((driver.total_km || 0) ?? 0).toLocaleString('en-IN')}</p>
              <p className="text-xs text-green-500">Total KM</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star size={16} className="text-amber-500 fill-amber-500" />
                <span className="text-xl font-bold text-amber-700">{Number((driver.rating || 0) ?? 0).toFixed(1)}</span>
              </div>
              <p className="text-xs text-amber-500">Rating</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-purple-700">{driver.safety_score || '—'}</p>
              <p className="text-xs text-purple-500">Safety Score</p>
            </div>
          </div>
        </div>

        {/* Current Assignment */}
        {(driver.assigned_vehicle || driver.current_trip) && (
          <div className="card border-l-4 border-l-purple-500">
            <h3 className="font-semibold text-gray-900 mb-3">Current Assignment</h3>
            {driver.assigned_vehicle && <InfoRow label="Vehicle" value={<span className="font-mono text-purple-600">{driver.assigned_vehicle}</span>} icon={Truck} />}
            {driver.current_trip && <InfoRow label="Trip" value={<span className="font-mono text-blue-600">{driver.current_trip}</span>} />}
            {driver.current_location && <InfoRow label="Location" value={driver.current_location} icon={MapPin} />}
          </div>
        )}

        {/* Emergency Contact */}
        {driver.emergency_contact_name && (
          <div className="card border-l-4 border-l-red-400">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" />Emergency Contact</h3>
            <InfoRow label="Name" value={driver.emergency_contact_name} />
            <InfoRow label="Phone" value={driver.emergency_contact_phone} icon={Phone} />
            <InfoRow label="Relation" value={driver.emergency_contact_relation} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Trip History
// ═══════════════════════════════════════════════════════
function TripsTab({ driverId }: { driverId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['driver-trips', driverId, page],
    queryFn: () => driverService.getTrips(driverId, { page, page_size: 10 }),
  });

  if (isLoading) return <div className="animate-pulse space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}</div>;

  const trips: DriverTrip[] = safeArray(data);
  const summary = data?.summary;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-primary-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-primary-700">{summary.total_trips}</p>
            <p className="text-xs text-primary-500">Total Trips</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-700">{summary.completed}</p>
            <p className="text-xs text-green-500">Completed</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-700">{(summary.total_distance_km ?? 0).toLocaleString('en-IN')} km</p>
            <p className="text-xs text-blue-500">Distance</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-amber-700">₹{(summary.total_earnings ?? 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-amber-500">Earnings</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-purple-700">{summary.on_time_pct}%</p>
            <p className="text-xs text-purple-500">On-Time</p>
          </div>
        </div>
      )}

      {/* Trip Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Trip #</th>
              <th className="table-header">Route</th>
              <th className="table-header">Vehicle</th>
              <th className="table-header">Distance</th>
              <th className="table-header">Date</th>
              <th className="table-header">Earnings</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="table-cell font-mono text-primary-600 text-sm">{t.trip_number}</td>
                <td className="table-cell text-sm">{t.route}</td>
                <td className="table-cell font-mono text-sm">{t.vehicle_registration}</td>
                <td className="table-cell text-sm">{t.distance_km} km</td>
                <td className="table-cell text-sm">{new Date(t.start_date).toLocaleDateString('en-IN')}</td>
                <td className="table-cell text-sm font-medium">₹{(t.earnings ?? 0).toLocaleString('en-IN')}</td>
                <td className="table-cell"><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        {(data?.total_pages || 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-gray-500">Page {page} of {data?.total_pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-secondary text-sm px-3 py-1">Previous</button>
              <button disabled={page >= (data?.total_pages || 1)} onClick={() => setPage(page + 1)} className="btn-primary text-sm px-3 py-1">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Driving Behaviour
// ═══════════════════════════════════════════════════════
function BehaviourTab({ driverId }: { driverId: number }) {
  const { data, isLoading } = useQuery<DriverBehaviour>({
    queryKey: ['driver-behaviour', driverId],
    queryFn: () => driverService.getBehaviour(driverId),
  });

  if (isLoading) return <div className="animate-pulse space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded" />)}</div>;
  if (!data) return null;

  const metrics = data.metrics ?? {} as any;
  const events = data.events ?? [];
  const speed_distribution = data.speed_distribution ?? [];
  const daily_trends = data.daily_trends ?? [];
  const gradeColor = metrics.safety_grade === 'A' ? '#22c55e' : metrics.safety_grade === 'B' ? '#3b82f6' : metrics.safety_grade === 'C' ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card flex flex-col items-center justify-center">
          <ScoreRing score={metrics.safety_score} label="Safety Score" size={100} color={gradeColor} />
          <span className="mt-2 px-3 py-0.5 rounded-full text-sm font-bold" style={{ backgroundColor: gradeColor + '20', color: gradeColor }}>
            Grade {metrics.safety_grade}
          </span>
        </div>
        <div className="card col-span-3">
          <h3 className="font-semibold text-gray-900 mb-3">Key Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center"><Gauge size={20} className="mx-auto text-blue-500 mb-1" /><p className="text-lg font-bold">{metrics.average_speed_kmh}</p><p className="text-xs text-gray-500">Avg Speed (km/h)</p></div>
            <div className="text-center"><Zap size={20} className="mx-auto text-red-500 mb-1" /><p className="text-lg font-bold">{metrics.harsh_braking_events}</p><p className="text-xs text-gray-500">Harsh Braking</p></div>
            <div className="text-center"><AlertTriangle size={20} className="mx-auto text-amber-500 mb-1" /><p className="text-lg font-bold">{metrics.over_speed_alerts}</p><p className="text-xs text-gray-500">Over Speed</p></div>
            <div className="text-center"><Fuel size={20} className="mx-auto text-green-500 mb-1" /><p className="text-lg font-bold">{metrics.fuel_efficiency_kmpl}</p><p className="text-xs text-gray-500">Fuel (km/l)</p></div>
          </div>
        </div>
      </div>

      {/* Events & Speed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Safety Events</h3>
          <div className="space-y-3">
            {Object.entries(events).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{val.count}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${val.trend === 'down' ? 'bg-green-100 text-green-700' : val.trend === 'up' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                    {val.trend === 'down' ? '↓' : val.trend === 'up' ? '↑' : '→'} {val.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Speed Distribution</h3>
          <div className="space-y-3">
            {speed_distribution.map((s) => (
              <div key={s.range} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28">{s.range}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div className="h-5 bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${s.percentage}%` }} />
                </div>
                <span className="text-sm font-medium w-12 text-right">{s.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Compliance & Driving Hours</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-700">{metrics.rest_compliance_pct}%</p>
            <p className="text-xs text-green-600">Rest Compliance</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-700">{metrics.seatbelt_compliance_pct}%</p>
            <p className="text-xs text-blue-600">Seatbelt Compliance</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-purple-700">{metrics.night_driving_hours}h</p>
            <p className="text-xs text-purple-600">Night Driving</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{metrics.idle_time_hours}h</p>
            <p className="text-xs text-amber-600">Idle Time</p>
          </div>
        </div>
      </div>

      {/* Daily Trend Mini */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Daily Safety Score (30 days)</h3>
        <div className="flex items-end gap-1 h-24">
          {daily_trends.map((d) => {
            const h = (d.safety_score / 100) * 80;
            const color = d.safety_score >= 80 ? '#22c55e' : d.safety_score >= 60 ? '#f59e0b' : '#ef4444';
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center" title={`${d.label}: ${d.safety_score}`}>
                <div className="w-full rounded-t" style={{ height: `${h}px`, backgroundColor: color, minHeight: 4 }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{daily_trends[0]?.label}</span>
          <span>{daily_trends[daily_trends.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Documents
// ═══════════════════════════════════════════════════════
function DocumentsTab({ driverId }: { driverId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['driver-documents', driverId],
    queryFn: () => driverService.getDocuments(driverId),
  });

  if (isLoading) return <div className="animate-pulse space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded" />)}</div>;

  const docs: DriverDocument[] = safeArray(data);
  const compliance = data?.compliance;

  return (
    <div className="space-y-5">
      {/* Compliance Summary */}
      {compliance && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-700">{compliance.uploaded}/{compliance.total}</p>
            <p className="text-xs text-green-600">Uploaded</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-red-700">{compliance.missing}</p>
            <p className="text-xs text-red-600">Missing</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{compliance.expired}</p>
            <p className="text-xs text-amber-600">Expired</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-700">{compliance.approved}</p>
            <p className="text-xs text-blue-600">Approved</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-purple-700">{compliance.compliance_pct}%</p>
            <p className="text-xs text-purple-600">Compliance</p>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Document</th>
              <th className="table-header">Number</th>
              <th className="table-header">Status</th>
              <th className="table-header">Expiry</th>
              <th className="table-header">Approval</th>
              <th className="table-header">Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} className="border-b hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{doc.label}</p>
                      {doc.mandatory && <span className="text-xs text-red-500">Required</span>}
                    </div>
                  </div>
                </td>
                <td className="table-cell font-mono text-sm">{doc.document_number || '—'}</td>
                <td className="table-cell">
                  {doc.status === 'uploaded'
                    ? <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 size={14} /> Uploaded</span>
                    : <span className="flex items-center gap-1 text-red-500 text-sm"><XCircle size={14} /> Missing</span>}
                </td>
                <td className="table-cell">
                  {doc.expiry_date ? (
                    <span className={`text-sm ${doc.expiry_status === 'expired' ? 'text-red-600 font-medium' : doc.expiry_status === 'expiring_soon' ? 'text-amber-600' : ''}`}>
                      {new Date(doc.expiry_date).toLocaleDateString('en-IN')}
                      {doc.expiry_status === 'expired' && <span className="text-xs ml-1">(expired)</span>}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="table-cell">
                  <StatusBadge status={doc.approval_status} />
                </td>
                <td className="table-cell">
                  {doc.file_url ? (
                    <button className="text-primary-600 hover:text-primary-800 text-sm flex items-center gap-1"><Eye size={14} /> View</button>
                  ) : (
                    <button className="text-sm text-gray-400">Upload</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Performance
// ═══════════════════════════════════════════════════════
function PerformanceTab({ driverId }: { driverId: number }) {
  const { data, isLoading } = useQuery<DriverPerformance>({
    queryKey: ['driver-performance', driverId],
    queryFn: () => driverService.getPerformance(driverId),
  });

  if (isLoading) return <div className="animate-pulse space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded" />)}</div>;
  if (!data) return null;

  const grade = data.grade ?? '';
  const gradeColor = grade === 'A+' || grade === 'A' ? '#22c55e' : grade.startsWith('B') ? '#3b82f6' : '#f59e0b';

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card flex flex-col items-center justify-center">
          <ScoreRing score={Math.round(data.overall_score ?? 0)} label="Overall" size={120} color={gradeColor} />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-extrabold" style={{ color: gradeColor }}>{grade}</span>
            <div className="flex items-center gap-1">
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <span className="font-semibold">{Number(data.rating ?? 0).toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Component Scores */}
        <div className="card col-span-3">
          <h3 className="font-semibold text-gray-900 mb-4">Score Components</h3>
          <div className="space-y-3">
            {Object.entries(data.components).map(([key, comp]) => {
              const color = comp.score >= 80 ? '#22c55e' : comp.score >= 60 ? '#3b82f6' : '#f59e0b';
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-40">{comp.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${comp.score}%`, backgroundColor: color }}>
                      {comp.score > 12 && <span className="text-white text-xs font-medium">{comp.score}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">{Number(comp.weight * 100).toFixed(0)}% wt</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fleet Comparison */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">vs Fleet Average</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(data.components).map(([key, comp]) => {
            const fleetKey = key.replace(/_/g, '_') + '_score';
            const fleetVal = (data.fleet_comparison as any)[fleetKey] || (data.fleet_comparison as any)[key] || data.fleet_comparison.overall;
            const diff = comp.score - fleetVal;
            return (
              <div key={key} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm text-gray-600">{comp.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{comp.score}</span>
                  <span className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{diff >= 0 ? '+' : ''}{Number(diff ?? 0).toFixed(0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Monthly Trend</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Month</th>
                <th className="table-header">Overall</th>
                <th className="table-header">Trips</th>
                <th className="table-header">On-Time %</th>
                <th className="table-header">Safety</th>
                <th className="table-header">Fuel Eff.</th>
                <th className="table-header">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly_trend.map((m) => (
                <tr key={m.month} className="border-b">
                  <td className="table-cell font-medium">{m.month}</td>
                  <td className="table-cell font-semibold">{m.overall}</td>
                  <td className="table-cell">{m.trips_completed}</td>
                  <td className="table-cell">{m.on_time_pct}%</td>
                  <td className="table-cell">{m.safety_score}</td>
                  <td className="table-cell">{m.fuel_efficiency} km/l</td>
                  <td className="table-cell flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" />{Number(m.feedback_avg ?? 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center"><p className="text-xl font-bold text-primary-700">{data.stats.total_trips}</p><p className="text-xs text-gray-500">Total Trips</p></div>
        <div className="card text-center"><p className="text-xl font-bold text-green-700">{(data.stats.total_km ?? 0).toLocaleString('en-IN')}</p><p className="text-xs text-gray-500">Total KM</p></div>
        <div className="card text-center"><p className="text-xl font-bold text-blue-700">{data.stats.active_days}</p><p className="text-xs text-gray-500">Active Days</p></div>
        <div className="card text-center"><p className="text-xl font-bold text-purple-700">{data.stats.avg_daily_km}</p><p className="text-xs text-gray-500">Avg Daily KM</p></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Attendance
// ═══════════════════════════════════════════════════════
function AttendanceTab({ driverId }: { driverId: number }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data, isLoading } = useQuery<DriverAttendance>({
    queryKey: ['driver-attendance', driverId, month],
    queryFn: () => driverService.getAttendance(driverId, { month }),
  });

  if (isLoading) return <div className="animate-pulse space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}</div>;
  if (!data) return null;

  const items = safeArray(data?.items ?? data);
  const summary = data?.summary;

  const statusColor: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    on_trip: 'bg-purple-100 text-purple-700',
    absent: 'bg-red-100 text-red-700',
    leave: 'bg-amber-100 text-amber-700',
    half_day: 'bg-blue-100 text-blue-700',
    weekly_off: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-5">
      {/* Month Selector & Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input-field w-44" />
        {summary && (
          <div className="flex gap-4 text-sm flex-wrap">
            <span className="text-green-600 font-medium">{summary.present_days} Present</span>
            <span className="text-purple-600 font-medium">{summary.on_trip_days} On Trip</span>
            <span className="text-red-600 font-medium">{summary.absent_days} Absent</span>
            <span className="text-amber-600 font-medium">{summary.leave_days} Leave</span>
            <span className="text-gray-500">{summary.total_hours}h Total</span>
            <span className="font-bold text-primary-600">{summary.attendance_pct}%</span>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Date</th>
              <th className="table-header">Day</th>
              <th className="table-header">Status</th>
              <th className="table-header">Check In</th>
              <th className="table-header">Check Out</th>
              <th className="table-header">Hours</th>
              <th className="table-header">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.date} className="border-b hover:bg-gray-50">
                <td className="table-cell font-medium">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                <td className="table-cell text-gray-500">{r.day.slice(0, 3)}</td>
                <td className="table-cell">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[r.status] || 'bg-gray-100 text-gray-500'}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="table-cell">{r.check_in || '—'}</td>
                <td className="table-cell">{r.check_out || '—'}</td>
                <td className="table-cell font-medium">{r.hours_worked > 0 ? `${r.hours_worked}h` : '—'}</td>
                <td className="table-cell text-gray-400">{r.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Card */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-700">{summary.present_days}</p>
            <p className="text-xs text-green-600">Present</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-red-700">{summary.absent_days}</p>
            <p className="text-xs text-red-600">Absent</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-700">{summary.total_hours}</p>
            <p className="text-xs text-blue-600">Total Hours</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-primary-700">{summary.attendance_pct}%</p>
            <p className="text-xs text-primary-500">Attendance</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════
export default function DriverDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: driver, isLoading } = useQuery<Driver>({
    queryKey: ['driver', id],
    queryFn: () => driverService.get(Number(id)),
    enabled: !!id,
  });

  if (isLoading) return <LoadingPage />;
  if (!driver) return <div className="text-center py-16 text-gray-400">Driver not found</div>;

  const driverName = driver.full_name || driver.name || [driver.first_name, driver.last_name].filter(Boolean).join(' ') || 'Unknown';
  const driverId = Number(id);

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <Link to="/drivers">Drivers</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <span className="text-gray-900 font-medium">{driverName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/drivers')} className="btn-icon mt-1"><ArrowLeft size={18} /></button>
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          {driver.photo_url ? (
            <img src={driver.photo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <span className="text-primary-700 font-bold text-xl">{driverName.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{driverName}</h1>
            <StatusBadge status={driver.status} />
            {driver.safety_score != null && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${driver.safety_score >= 80 ? 'bg-green-100 text-green-700' : driver.safety_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                <Shield size={11} className="inline -mt-0.5 mr-0.5" />Safety {driver.safety_score}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm">
            {driver.employee_id} &middot; {driver.license_type} License &middot; {driver.city}, {driver.state}
            {driver.assigned_vehicle && <span> &middot; <Truck size={13} className="inline -mt-0.5" /> {driver.assigned_vehicle}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2 text-sm"><Edit size={15} /> Edit</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab driver={driver} />}
        {activeTab === 'trips' && <TripsTab driverId={driverId} />}
        {activeTab === 'behaviour' && <BehaviourTab driverId={driverId} />}
        {activeTab === 'documents' && <DocumentsTab driverId={driverId} />}
        {activeTab === 'performance' && <PerformanceTab driverId={driverId} />}
        {activeTab === 'attendance' && <AttendanceTab driverId={driverId} />}
      </div>
    </div>
  );
}
