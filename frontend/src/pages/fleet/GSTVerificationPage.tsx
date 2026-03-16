import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gstService } from '@/services/dataService';

export default function GSTVerificationPage() {
  const [gstin, setGstin] = useState('');
  const [searched, setSearched] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['gst-verify', searched],
    queryFn: () => gstService.verifyGSTIN(searched),
    enabled: !!searched,
    throwOnError: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (gstin.trim()) setSearched(gstin.trim().toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GST Verification</h1>
        <p className="text-gray-500 text-sm mt-1">Verify client/vendor GSTIN details</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={gstin}
          onChange={(e) => setGstin(e.target.value)}
          placeholder="Enter GSTIN (e.g., 33AABCT1234F1ZN)"
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          maxLength={15}
        />
        <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {isLoading ? 'Verifying...' : 'Verify GSTIN'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">Failed to verify GSTIN.</div>
      )}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{data.gstin}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${data.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {data.status}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">Legal Name</span><p className="font-medium">{data.legal_name}</p></div>
            <div><span className="text-gray-500">Trade Name</span><p className="font-medium">{data.trade_name}</p></div>
            <div><span className="text-gray-500">Business Type</span><p className="font-medium">{data.business_type}</p></div>
            <div><span className="text-gray-500">State</span><p className="font-medium">{data.state}</p></div>
            <div><span className="text-gray-500">Registration Date</span><p className="font-medium">{data.registration_date}</p></div>
            <div className="col-span-2 md:col-span-1"><span className="text-gray-500">Address</span><p className="font-medium">{data.address}</p></div>
          </div>

          {data.hsn_info && (
            <div className="mt-4">
              <span className="text-gray-500 text-sm">HSN/SAC Codes</span>
              <ul className="mt-1 text-sm list-disc list-inside">
                {data.hsn_info.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {data.filing_status && (
            <div className="mt-4">
              <span className="text-gray-500 text-sm">Recent Filing Status</span>
              <div className="mt-1 space-y-1">
                {data.filing_status.map((f: any, i: number) => (
                  <div key={i} className="flex gap-4 text-sm">
                    <span className="font-medium w-20">{f.return_type}</span>
                    <span>{f.period}</span>
                    <span className={f.status === 'Filed' ? 'text-green-600' : 'text-red-600'}>{f.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
