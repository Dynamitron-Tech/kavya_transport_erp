import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Truck, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { publicTrackingService } from '@/services/dataService';
import type { PublicTrackingData } from '@/types';

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Booking Received', color: 'text-gray-600', icon: <Clock className="w-5 h-5" /> },
  confirmed: { label: 'Confirmed', color: 'text-blue-600', icon: <CheckCircle className="w-5 h-5" /> },
  in_transit: { label: 'In Transit', color: 'text-yellow-600', icon: <Truck className="w-5 h-5" /> },
  delivered: { label: 'Delivered', color: 'text-green-600', icon: <CheckCircle className="w-5 h-5" /> },
  completed: { label: 'Completed', color: 'text-green-600', icon: <CheckCircle className="w-5 h-5" /> },
};

export default function CustomerTrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const result = await publicTrackingService.getTracking(token);
        setData(result);
      } catch {
        setError('Invalid or expired tracking link.');
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading tracking info...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Tracking Not Found</h2>
          <p className="text-gray-500">{error || 'This tracking link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[data.status || ''] || STATUS_MAP.draft;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Shipment Tracking</h1>
            <p className="text-xs text-gray-500">Real-time shipment status</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-opacity-10 ${statusInfo.color} bg-current`}>
              <span className={statusInfo.color}>{statusInfo.icon}</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Status</p>
              <h2 className={`text-2xl font-bold ${statusInfo.color}`}>{statusInfo.label}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Job ID</p>
              <p className="font-medium text-gray-900">#{data.job_id}</p>
            </div>
            <div>
              <p className="text-gray-500">Last Updated</p>
              <p className="font-medium text-gray-900">{new Date(data.generated_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Location Card (placeholder for map) */}
        {data.location && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" /> Current Location
            </h3>
            <div className="bg-gray-100 rounded-xl h-64 flex items-center justify-center text-gray-400 text-sm">
              Map — Lat: {data.location.lat.toFixed(4)}, Lng: {data.location.lng.toFixed(4)}
            </div>
          </div>
        )}

        {/* Timeline (static for now) */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Shipment Timeline</h3>
          <div className="space-y-4">
            {(['draft', 'confirmed', 'in_transit', 'delivered'] as const).map((step, idx) => {
              const info = STATUS_MAP[step] || STATUS_MAP.draft;
              const steps = ['draft', 'confirmed', 'in_transit', 'delivered'];
              const currentIdx = steps.indexOf(data.status || 'draft');
              const reached = idx <= currentIdx;
              return (
                <div key={step} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${reached ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <p className={`font-medium ${reached ? 'text-gray-900' : 'text-gray-400'}`}>{info.label}</p>
                    {reached && idx === currentIdx && (
                      <p className="text-xs text-blue-600 mt-0.5">Current</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
