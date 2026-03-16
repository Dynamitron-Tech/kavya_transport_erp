import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Truck, Search, MapPin, Fuel, Gauge, Wifi, WifiOff, Wrench } from 'lucide-react';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { fleetService } from '@/services/dataService';
import type { FleetVehicle } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function FleetVehiclesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-vehicles', search, statusFilter, typeFilter],
    queryFn: () => fleetService.getVehicles({ search, status: statusFilter || undefined, vehicle_type: typeFilter || undefined }),
  });

  const vehicles: FleetVehicle[] = safeArray(data);

  const columns: Column<FleetVehicle>[] = [
    {
      key: 'registration_number',
      header: 'Vehicle',
      render: (v) => (
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-gray-400" />
          <div>
            <p className="font-medium text-gray-900">{v.registration_number}</p>
            <p className="text-xs text-gray-500">{v.make} {v.model}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle_type',
      header: 'Type',
      render: (v) => <span className="capitalize text-sm">{v.vehicle_type.replace('_', ' ')}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: 'assigned_driver',
      header: 'Driver',
      render: (v) => <span className="text-sm">{v.assigned_driver || '—'}</span>,
    },
    {
      key: 'last_location',
      header: 'Location',
      render: (v) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <MapPin className="w-3 h-3" />
          <span className="truncate max-w-[160px]">{v.last_location}</span>
        </div>
      ),
    },
    {
      key: 'fuel_efficiency',
      header: 'Mileage',
      render: (v) => (
        <div className="flex items-center gap-1 text-sm">
          <Fuel className="w-3 h-3 text-gray-400" />
          <span>{v.fuel_efficiency} km/l</span>
        </div>
      ),
    },
    {
      key: 'odometer',
      header: 'Odometer',
      render: (v) => <span className="text-sm">{(v.odometer ?? 0).toLocaleString('en-IN')} km</span>,
    },
    {
      key: 'gps_enabled',
      header: 'GPS',
      render: (v) => v.gps_enabled
        ? <Wifi className="w-4 h-4 text-green-500" />
        : <WifiOff className="w-4 h-4 text-gray-300" />,
    },
  ];

  const statusCounts = {
    total: data?.total || 0,
    on_trip: vehicles.filter(v => v.status === 'on_trip').length,
    available: vehicles.filter(v => v.status === 'available').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Fleet Vehicles</h1>
        <p className="page-subtitle">Manage and monitor all vehicles in your fleet</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Vehicles" value={statusCounts.total} icon={<Truck className="w-5 h-5" />} color="blue" />
        <KPICard title="On Trip" value={statusCounts.on_trip} icon={<MapPin className="w-5 h-5" />} color="green" />
        <KPICard title="Available" value={statusCounts.available} icon={<Gauge className="w-5 h-5" />} color="purple" />
        <KPICard title="In Maintenance" value={statusCounts.maintenance} icon={<Wrench className="w-5 h-5" />} color="amber" />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by registration, make, model..."
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="on_trip">On Trip</option>
            <option value="available">Available</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="input w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="truck">Truck</option>
            <option value="trailer">Trailer</option>
            <option value="tanker">Tanker</option>
            <option value="container">Container</option>
            <option value="mini_truck">Mini Truck</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={vehicles}
          isLoading={isLoading}
          onRowClick={(v) => navigate(`/fleet/vehicles/${v.id}`)}
          emptyMessage="No vehicles found"
        />
      </div>
    </div>
  );
}
