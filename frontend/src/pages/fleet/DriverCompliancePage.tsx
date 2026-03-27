import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sarathiService, echallanService } from '@/services/dataService';

export default function DriverCompliancePage() {
  const [dlNumber, setDlNumber] = useState('');
  const [dob, setDob] = useState('');
  const [searched, setSearched] = useState({ dl: '', dob: '' });

  const { data: dlData, isLoading } = useQuery({
    queryKey: ['sarathi-verify', searched.dl, searched.dob],
    queryFn: () => sarathiService.verifyDL(searched.dl, searched.dob),
    enabled: !!searched.dl && !!searched.dob,
    throwOnError: false,
  });

  const { data: challans } = useQuery({
    queryKey: ['echallan-driver', searched.dl],
    queryFn: () => echallanService.getByDriver(searched.dl),
    enabled: !!searched.dl,
    throwOnError: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (dlNumber.trim() && dob) setSearched({ dl: dlNumber.trim().toUpperCase(), dob });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Driver Compliance</h1>
        <p className="text-gray-500 text-sm mt-1">Verify Driving Licence via Sarathi & check challans</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={dlNumber}
          onChange={(e) => setDlNumber(e.target.value)}
          placeholder="DL Number (e.g., TN39 20200001234)"
          className="flex-1 min-w-[200px] max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Verifying...' : 'Verify DL'}
        </button>
      </form>

      {dlData && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">DL Verification — {dlData.dl_number}</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${dlData.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {dlData.valid ? '✅ VALID' : '❌ INVALID'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Holder Name</span><p className="font-medium">{dlData.holder_name || '-'}</p></div>
              <div><span className="text-gray-500">Date of Birth</span><p className="font-medium">{dlData.dob || '-'}</p></div>
              <div><span className="text-gray-500">Issue Date</span><p className="font-medium">{dlData.issue_date || '-'}</p></div>
              <div><span className="text-gray-500">Valid Upto</span><p className="font-medium">{dlData.valid_upto || '-'}</p></div>
              <div><span className="text-gray-500">Vehicle Classes</span><p className="font-medium">{(dlData.vehicle_classes || []).join(', ') || '-'}</p></div>
              <div><span className="text-gray-500">Blood Group</span><p className="font-medium">{dlData.blood_group || '-'}</p></div>
              <div><span className="text-gray-500">RTO</span><p className="font-medium">{dlData.issuing_authority || '-'}</p></div>
              <div><span className="text-gray-500">Status</span><p className="font-medium">{dlData.status || '-'}</p></div>
            </div>
          </div>

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
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ch.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {ch.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
