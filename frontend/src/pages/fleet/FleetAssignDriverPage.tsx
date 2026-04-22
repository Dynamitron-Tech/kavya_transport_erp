import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, User, Search, CheckCircle, XCircle, Link } from 'lucide-react';
import { fleetService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import { toast } from 'react-hot-toast';

interface VehicleAssignment {
  vehicle_id: number;
  registration_number: string;
  vehicle_type: string | null;
  status: string | null;
  default_driver_id: number | null;
  driver: {
    id: number;
    name: string;
    phone: string | null;
    status: string | null;
    license_number: string | null;
  } | null;
}

interface DriverOption {
  id: number;
  name: string;
  phone: string | null;
  status: string | null;
  assigned_vehicle: string | null;
}

export default function FleetAssignDriverPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['fleet-vehicle-assignments'],
    queryFn: fleetService.getVehicleAssignments,
  });

  const { data: driversData } = useQuery({
    queryKey: ['fleet-drivers-for-assign'],
    queryFn: () => fleetService.getDrivers({ limit: 200 }),
  });

  const assignments: VehicleAssignment[] = safeArray(assignmentsData);

  // Only show drivers that have a linked user account (same set as the Drivers tab)
  const allDrivers: DriverOption[] = safeArray(driversData)
    .filter((d: any) => d.user_id != null)
    .map((d: any) => ({
    id: d.id,
    name: d.name || d.full_name || `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
    phone: d.phone ?? null,
    status: d.status ?? null,
    assigned_vehicle: d.assigned_vehicle ?? null,
  }));

  const assignMutation = useMutation({
    mutationFn: ({ vehicleId, driverId }: { vehicleId: number; driverId: number | null }) =>
      fleetService.assignDriverToVehicle(vehicleId, driverId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicle-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['lr-lookup-vehicles'] });
      toast.success(vars.driverId ? 'Driver assigned successfully' : 'Driver unassigned');
      setEditingVehicleId(null);
      setSelectedDriverId(null);
    },
    onError: () => {
      toast.error('Failed to assign driver');
    },
  });

  const filtered = assignments.filter((v) =>
    v.registration_number.toLowerCase().includes(search.toLowerCase()) ||
    (v.driver?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (v: VehicleAssignment) => {
    setEditingVehicleId(v.vehicle_id);
    setSelectedDriverId(v.default_driver_id);
  };

  const cancelEdit = () => {
    setEditingVehicleId(null);
    setSelectedDriverId(null);
  };

  const saveAssignment = (vehicleId: number) => {
    assignMutation.mutate({ vehicleId, driverId: selectedDriverId });
  };

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-700';
      case 'ON_TRIP': return 'bg-blue-100 text-blue-700';
      case 'MAINTENANCE': return 'bg-amber-100 text-amber-700';
      case 'INACTIVE': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const assignedCount = assignments.filter((v) => v.default_driver_id).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Link className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assign Drivers to Vehicles</h1>
            <p className="text-sm text-gray-500">
              {assignedCount} of {assignments.length} vehicles have a default driver assigned
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Vehicles</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{assignments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Assigned</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{assignedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Unassigned</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{assignments.length - assignedCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search vehicle or driver..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Vehicle</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Assigned Driver</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">No vehicles found</td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.vehicle_id} className="hover:bg-gray-50">
                  {/* Vehicle */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-mono font-semibold text-gray-900">
                        {v.registration_number}
                      </span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3 text-gray-600">
                    {v.vehicle_type?.replace(/_/g, ' ') ?? '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(v.status)}`}>
                      {v.status ?? '—'}
                    </span>
                  </td>

                  {/* Assigned Driver — edit inline */}
                  <td className="px-4 py-3">
                    {editingVehicleId === v.vehicle_id ? (
                      <select
                        value={selectedDriverId ?? ''}
                        onChange={(e) => setSelectedDriverId(e.target.value ? parseInt(e.target.value) : null)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                        autoFocus
                      >
                        <option value="">-- No driver assigned --</option>
                        {allDrivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}{d.phone ? ` | ${d.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : v.driver ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{v.driver.name}</p>
                          <p className="text-xs text-gray-500">{v.driver.phone ?? ''}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Not assigned</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    {editingVehicleId === v.vehicle_id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveAssignment(v.vehicle_id)}
                          disabled={assignMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs font-medium hover:bg-gray-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(v)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                      >
                        {v.driver ? 'Change Driver' : 'Assign Driver'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
