import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { vahanService, echallanService } from '@/services/dataService';

export default function VehicleCompliancePage() {
  const [regNumber, setRegNumber] = useState('');
  const [searched, setSearched] = useState('');

  const { data: fullCheck, isLoading, error } = useQuery({
    queryKey: ['vahan-full-check', searched],
    queryFn: () => vahanService.fullCheck(searched),
    enabled: !!searched,
    throwOnError: false,
  });

  const { data: challans } = useQuery({
    queryKey: ['echallan-vehicle', searched],
    queryFn: () => echallanService.getByVehicle(searched),
    enabled: !!searched,
    throwOnError: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (regNumber.trim()) setSearched(regNumber.trim().toUpperCase());
  };

  const checks = fullCheck?.checks || {};

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      VALID: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      NOT_FOUND: 'bg-gray-100 text-gray-600',
      CLEAR: 'bg-green-100 text-green-800',
      BLACKLISTED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-yellow-100 text-yellow-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Compliance</h1>
        <p className="text-gray-500 text-sm mt-1">Check RC, Insurance, Fitness, Permit, PUC & Challans via VAHAN / eChallan</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={regNumber}
          onChange={(e) => setRegNumber(e.target.value)}
          placeholder="Enter vehicle number (e.g., TN39AB1234)"
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Checking...' : 'Check Compliance'}
        </button>
      </form>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700">
          <p className="font-medium">VAHAN/eChallan API is not configured</p>
          <p className="text-sm mt-1">The government VAHAN API integration requires API credentials. Contact your administrator to configure the VAHAN API keys in the system settings.</p>
        </div>
      )}

      {fullCheck && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Compliance Summary — {fullCheck.reg_number}</h2>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${fullCheck.overall_status === 'COMPLIANT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {fullCheck.overall_status}
                </span>
                <span className="text-sm text-gray-400">Score: {fullCheck.compliance_score}/100</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(checks).map(([key, val]: [string, any]) => (
                <div key={key} className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1 capitalize">{key}</p>
                  {statusBadge(val?.status || 'N/A')}
                </div>
              ))}
            </div>
          </div>

          {/* RC Details */}
          {checks.rc && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold mb-3">🚛 RC Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">Owner</span><p className="font-medium">{checks.rc.owner_name || '-'}</p></div>
                <div><span className="text-gray-500">Vehicle Class</span><p className="font-medium">{checks.rc.vehicle_class || '-'}</p></div>
                <div><span className="text-gray-500">Fuel Type</span><p className="font-medium">{checks.rc.fuel_type || '-'}</p></div>
                <div><span className="text-gray-500">Registration Date</span><p className="font-medium">{checks.rc.registration_date || '-'}</p></div>
                <div><span className="text-gray-500">Chassis No</span><p className="font-medium">{checks.rc.chassis_number || '-'}</p></div>
                <div><span className="text-gray-500">Engine No</span><p className="font-medium">{checks.rc.engine_number || '-'}</p></div>
                <div><span className="text-gray-500">Maker</span><p className="font-medium">{checks.rc.maker || '-'}</p></div>
                <div><span className="text-gray-500">Status</span>{statusBadge(checks.rc.status || '-')}</div>
              </div>
            </div>
          )}

          {/* Insurance */}
          {checks.insurance && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold mb-3">🛡️ Insurance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">Policy No</span><p className="font-medium">{checks.insurance.policy_number || '-'}</p></div>
                <div><span className="text-gray-500">Company</span><p className="font-medium">{checks.insurance.company || '-'}</p></div>
                <div><span className="text-gray-500">Valid Upto</span><p className="font-medium">{checks.insurance.valid_upto || '-'}</p></div>
                <div><span className="text-gray-500">Status</span>{statusBadge(checks.insurance.status || '-')}</div>
              </div>
            </div>
          )}

          {/* Fitness */}
          {checks.fitness && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold mb-3">🔧 Fitness Certificate</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">Valid Upto</span><p className="font-medium">{checks.fitness.valid_upto || '-'}</p></div>
                <div><span className="text-gray-500">Status</span>{statusBadge(checks.fitness.status || '-')}</div>
              </div>
            </div>
          )}

          {/* Permit */}
          {checks.permit && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold mb-3">📋 Permit</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">Permit No</span><p className="font-medium">{checks.permit.permit_number || '-'}</p></div>
                <div><span className="text-gray-500">Type</span><p className="font-medium">{checks.permit.permit_type || '-'}</p></div>
                <div><span className="text-gray-500">Valid Upto</span><p className="font-medium">{checks.permit.valid_upto || '-'}</p></div>
                <div><span className="text-gray-500">Status</span>{statusBadge(checks.permit.status || '-')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Challans */}
      {challans && challans.challans?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-3">⚠️ Traffic Challans ({challans.count})</h3>
          <div className="text-sm mb-3 flex gap-4">
            <span className="text-red-600">Pending: ₹{challans.total_pending?.toLocaleString()}</span>
            <span className="text-green-600">Paid: ₹{challans.total_paid?.toLocaleString()}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Challan No</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Offence</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {challans.challans.map((ch: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{ch.challan_number}</td>
                    <td className="px-3 py-2">{ch.date}</td>
                    <td className="px-3 py-2">{ch.offence}</td>
                    <td className="px-3 py-2 text-right">₹{ch.amount?.toLocaleString()}</td>
                    <td className="px-3 py-2">{statusBadge(ch.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
