import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/Modal';
import { tripService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';

interface DriverTripRow {
  id: number;
  trip_number: string;
  origin: string;
  destination: string;
  trip_date?: string;
  status: string;
  vehicle_registration?: string;
  driver_name?: string;
}

export default function DriverTripsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver-trips', page],
    queryFn: () => tripService.list({ page, page_size: 20 }),
  });

  const rows = safeArray<DriverTripRow>(data);

  const columns: Column<DriverTripRow>[] = [
    {
      key: 'trip_number',
      header: 'Trip',
      render: (row) => <span className="font-mono text-sm font-semibold text-primary-600">{row.trip_number}</span>,
    },
    {
      key: 'route',
      header: 'Route',
      render: (row) => <span className="text-sm">{row.origin}{' -> '}{row.destination}</span>,
    },
    {
      key: 'trip_date',
      header: 'Date',
      render: (row) => <span className="text-sm">{row.trip_date ? new Date(row.trip_date).toLocaleDateString('en-IN') : '-'}</span>,
    },
    {
      key: 'vehicle_registration',
      header: 'Vehicle',
      render: (row) => <span className="text-sm">{row.vehicle_registration || '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Trips</h1>
          <p className="page-subtitle">Live trip data from operations API</p>
        </div>
        <Link to="/dashboard" className="btn-secondary">Back</Link>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={data?.total || 0}
        page={page}
        pageSize={20}
        isLoading={isLoading}
        onPageChange={setPage}
        onRefresh={() => refetch()}
        emptyMessage="No trips assigned"
      />
    </div>
  );
}
