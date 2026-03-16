import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Phone, Shield, Star, Truck } from 'lucide-react';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { fleetService } from '@/services/dataService';
import type { FleetDriver } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function FleetDriversPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-drivers', search, statusFilter],
    queryFn: () => fleetService.getDrivers({ search, status: statusFilter || undefined }),
  });

  const drivers: FleetDriver[] = safeArray(data);

  const safetyColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-amber-600';
    return 'text-red-600';
  };

  const columns: Column<FleetDriver>[] = [
    {
      key: 'name',
      header: 'Driver',
      render: (d) => {
        const name = d.name || 'Unknown';
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">{name.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{name}</p>
              <p className="text-xs text-gray-500">{d.phone}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'license_number',
      header: 'License',
      render: (d) => (
        <div>
          <p className="text-sm">{d.license_number}</p>
          <p className="text-xs text-gray-500">Exp: {new Date(d.license_expiry).toLocaleDateString('en-IN')}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'assigned_vehicle',
      header: 'Vehicle',
      render: (d) => d.assigned_vehicle ? (
        <div className="flex items-center gap-1 text-sm">
          <Truck className="w-3 h-3 text-gray-400" />
          <span>{d.assigned_vehicle}</span>
        </div>
      ) : <span className="text-gray-400 text-sm">Unassigned</span>,
    },
    {
      key: 'trips_completed',
      header: 'Trips',
      render: (d) => <span className="text-sm font-medium">{d.trips_completed}</span>,
    },
    {
      key: 'safety_score',
      header: 'Safety Score',
      render: (d) => (
        <div className="flex items-center gap-1">
          <Shield className="w-4 h-4 text-gray-400" />
          <span className={`text-sm font-semibold ${safetyColor(d.safety_score)}`}>{d.safety_score}</span>
        </div>
      ),
    },
  ];

  const statusCounts = {
    total: data?.total || 0,
    on_trip: drivers.filter(d => d.status === 'on_trip').length,
    available: drivers.filter(d => d.status === 'available').length,
    rest: drivers.filter(d => d.status === 'rest').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Fleet Drivers</h1>
        <p className="page-subtitle">Monitor driver assignments, performance and safety scores</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Drivers" value={statusCounts.total} icon={<Users className="w-5 h-5" />} color="blue" />
        <KPICard title="On Trip" value={statusCounts.on_trip} icon={<Truck className="w-5 h-5" />} color="green" />
        <KPICard title="Available" value={statusCounts.available} icon={<Star className="w-5 h-5" />} color="purple" />
        <KPICard title="On Rest" value={statusCounts.rest} icon={<Phone className="w-5 h-5" />} color="amber" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, license number..."
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="on_trip">On Trip</option>
            <option value="available">Available</option>
            <option value="rest">On Rest</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={drivers}
          isLoading={isLoading}
          onRowClick={(d) => navigate(`/fleet/drivers/${d.id}`)}
          emptyMessage="No drivers found"
        />
      </div>
    </div>
  );
}
