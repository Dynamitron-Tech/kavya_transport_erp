/**
 * SimulationPanel — Vehicle wear simulation: input controls + animated results.
 */
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';
import { vehicleService } from '@/services/dataService';
import WearAnimation from './WearAnimation';
import WearTimelineChart from './WearTimelineChart';
import { Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface SimResult {
  tyres: {
    position: string;
    tyre_id: number;
    start_tread: number;
    end_tread: number;
    wear_mm: number;
    wear_pct: number;
    replacement_needed: boolean;
    km_to_replacement: number | null;
  }[];
  milestones: { km: number; [pos: string]: number }[];
  total_replacements: number;
  summary: string;
}

interface VehicleOption {
  id: number;
  registration_number: string;
}

export default function SimulationPanel() {
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [simKm, setSimKm] = useState(10000);
  const [loadKg, setLoadKg] = useState(10000);
  const [roadType, setRoadType] = useState('MIXED');
  const [climate, setClimate] = useState('TEMPERATE');
  const [result, setResult] = useState<SimResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Vehicles list for the selector
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-for-sim'],
    queryFn: async () => {
      const res = await vehicleService.list({ limit: 200 });
      const raw = res as any;
      return Array.isArray(raw) ? raw : (raw?.data || raw?.items || []);
    },
  });
  const vehicles: VehicleOption[] = vehiclesData || [];

  // Simulation history
  const { data: historyData } = useQuery({
    queryKey: ['sim-history'],
    queryFn: async () => {
      const res = await api.get('/tyre/simulate/history');
      return (res as any)?.data || res;
    },
    enabled: showHistory,
  });
  const history = historyData?.sessions || [];

  const simulateMutation = useMutation({
    mutationFn: async () => {
      if (!vehicleId) throw new Error('Select a vehicle first');
      const payload = {
        vehicle_id: vehicleId,
        simulated_km: simKm,
        simulated_load_kg: loadKg,
        road_type: roadType,
        climate,
      };
      const res = await api.post('/tyre/simulate', payload);
      return (res as any)?.data || res;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Simulation complete!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || 'Simulation failed');
    },
  });

  const roadTypes = ['HIGHWAY', 'CITY', 'OFFROAD', 'MIXED'];
  const climates = ['TROPICAL', 'TEMPERATE', 'COLD', 'DRY'];

  return (
    <div className="space-y-6">
      {/* Input card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Simulation Parameters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Vehicle */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs text-gray-500 mb-1 font-medium">Vehicle</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— Select vehicle —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.registration_number}</option>
              ))}
            </select>
          </div>

          {/* KM */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">
              Distance (km): <span className="text-blue-600">{simKm.toLocaleString()}</span>
            </label>
            <input
              type="range" min="1000" max="100000" step="1000"
              value={simKm}
              onChange={e => setSimKm(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>1k</span><span>50k</span><span>100k</span>
            </div>
          </div>

          {/* Load */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">
              Load (kg): <span className="text-blue-600">{loadKg.toLocaleString()}</span>
            </label>
            <input
              type="range" min="2000" max="40000" step="500"
              value={loadKg}
              onChange={e => setLoadKg(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>2k</span><span>20k</span><span>40k</span>
            </div>
          </div>

          {/* Road type */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Road Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {roadTypes.map(r => (
                <button
                  key={r}
                  onClick={() => setRoadType(r)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition ${roadType === r ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Climate */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Climate</label>
            <div className="flex gap-1.5 flex-wrap">
              {climates.map(c => (
                <button
                  key={c}
                  onClick={() => setClimate(c)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition ${climate === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => simulateMutation.mutate()}
          disabled={!vehicleId || simulateMutation.isPending}
          className="mt-5 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
        >
          {simulateMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Play className="w-4 h-4" />
          }
          Run Simulation
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            {result.summary}
            {result.total_replacements > 0 && (
              <span className="ml-2 font-bold text-red-600">
                {result.total_replacements} tyre(s) need replacement!
              </span>
            )}
          </div>

          {/* Per-tyre rows */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-800">Per-Tyre Wear</h3>
            {result.tyres.map(t => (
              <div key={t.position} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 uppercase w-14">{t.position}</span>
                  <span className="text-gray-500 text-xs">
                    {t.start_tread.toFixed(1)} → {t.end_tread.toFixed(1)} mm (−{t.wear_mm.toFixed(2)} mm)
                  </span>
                  {t.replacement_needed && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Replace!</span>
                  )}
                </div>
                <WearAnimation
                  startTread={t.start_tread}
                  endTread={t.end_tread}
                  position={t.position}
                  durationMs={1400}
                />
              </div>
            ))}
          </div>

          {/* Timeline chart */}
          {result.milestones && result.milestones.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Wear Timeline</h3>
              <WearTimelineChart milestones={result.milestones} />
            </div>
          )}
        </div>
      )}

      {/* History toggle */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setShowHistory(h => !h)}
        >
          Past Simulations
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showHistory && (
          <div className="px-5 pb-4 overflow-auto max-h-64">
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No past simulations yet.</p>
            ) : (
              <table className="min-w-full text-xs">
                <thead className="text-gray-500 font-semibold border-b">
                  <tr>
                    <th className="pb-1 text-left">Vehicle</th>
                    <th className="pb-1 text-right">KM</th>
                    <th className="pb-1 text-left">Road</th>
                    <th className="pb-1 text-left">Climate</th>
                    <th className="pb-1 text-right">Replacements</th>
                    <th className="pb-1 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-1 text-gray-800">{s.registration_number || `#${s.vehicle_id}`}</td>
                      <td className="py-1 text-right">{s.simulated_km?.toLocaleString()}</td>
                      <td className="py-1">{s.road_type}</td>
                      <td className="py-1">{s.climate}</td>
                      <td className="py-1 text-right">{s.total_replacements ?? '—'}</td>
                      <td className="py-1 text-right text-gray-400">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
