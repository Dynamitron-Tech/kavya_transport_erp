import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { mapsService } from '@/services/dataService';

export default function RouteCalculatorPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [routeResult, setRouteResult] = useState<any>(null);

  const geocodeMutation = useMutation({
    mutationFn: async () => {
      const [originGeo, destGeo] = await Promise.all([
        mapsService.geocode(origin),
        mapsService.geocode(destination),
      ]);
      if (!originGeo.lat || !destGeo.lat) {
        throw new Error('Could not geocode one or both addresses');
      }
      const route = await mapsService.getRouteDistance(
        { lat: originGeo.lat, lng: originGeo.lng },
        { lat: destGeo.lat, lng: destGeo.lng },
      );
      setRouteResult({ ...route, originGeo, destGeo });
    },
  });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.trim() && destination.trim()) {
      geocodeMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Route Calculator</h1>
        <p className="text-gray-500 text-sm mt-1">Calculate distance and estimated time between locations</p>
      </div>

      <form onSubmit={handleCalculate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g., Coimbatore, Tamil Nadu"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Chennai, Tamil Nadu"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={geocodeMutation.isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
	>
          {geocodeMutation.isPending ? 'Calculating...' : 'Calculate Route'}
        </button>
      </form>

      {geocodeMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {geocodeMutation.error?.message || 'Could not calculate route.'}
        </div>
      )}

      {routeResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-500 text-sm mb-1">Distance</p>
            <p className="text-2xl font-bold">{routeResult.distance_km} km</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-500 text-sm mb-1">Duration</p>
            <p className="text-2xl font-bold">{routeResult.duration_text}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-500 text-sm mb-1">Origin</p>
            <p className="text-sm font-medium">{routeResult.originGeo?.formatted_address || origin}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-500 text-sm mb-1">Destination</p>
            <p className="text-sm font-medium">{routeResult.destGeo?.formatted_address || destination}</p>
          </div>
        </div>
      )}
    </div>
  );
}
