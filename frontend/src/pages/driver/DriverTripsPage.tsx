import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, StatusBadge } from '@/components/common/Modal';
import { driverService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface DriverTripRow {
  id: number;
  trip_number: string;
  origin: string;
  destination: string;
  trip_date?: string;
  status: string;
  vehicle_registration?: string;
  driver_name?: string;
  lr_numbers?: string[];
  lr_count?: number;
}

interface DriverTripLRDetail {
  id: number;
  lr_number: string;
  status?: string;
  consignor_name?: string;
  consignee_name?: string;
  origin?: string;
  destination?: string;
}

interface DriverTripDetail extends DriverTripRow {
  driver_phone?: string;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string;
  actual_end?: string;
  start_odometer?: number;
  end_odometer?: number;
  planned_distance_km?: number;
  actual_distance_km?: number;
  remarks?: string;
  lr_details?: DriverTripLRDetail[];
}

export default function DriverTripsPage() {
  const [page, setPage] = useState(1);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver-trips', page],
    queryFn: () => driverService.getMyTrips({ page, page_size: 20 }),
  });

  const detailQuery = useQuery({
    queryKey: ['driver-trip-detail', selectedTripId],
    queryFn: () => driverService.getMyTripDetail(selectedTripId as number),
    enabled: Boolean(selectedTripId),
  });

  const completeMutation = useMutation({
    mutationFn: (tripId: number) => driverService.completeMyTrip(tripId),
    onSuccess: () => {
      toast.success('Trip marked as completed');
      queryClient.invalidateQueries({ queryKey: ['driver-trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['driver-trip-detail', selectedTripId] });
      setSelectedTripId(null);
    },
    onError: () => {
      toast.error('Failed to complete trip');
    },
  });

  const rows = safeArray<DriverTripRow>(data);
  const total = (data as any)?.pagination?.total ?? rows.length;
  const tripDetail = (detailQuery.data as DriverTripDetail | undefined) ?? undefined;
  const selectedTripStatus = (tripDetail?.status || '').toLowerCase();
  const canComplete = Boolean(
    tripDetail && !['completed', 'cancelled'].includes(selectedTripStatus)
  );

  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN');
  };

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
      key: 'lr_numbers',
      header: 'LR',
      render: (row) => {
        const lrNumbers = row.lr_numbers || [];
        if (!lrNumbers.length) return <span className="text-sm text-gray-500">-</span>;

        const preview = lrNumbers.slice(0, 2).join(', ');
        const suffix = lrNumbers.length > 2 ? ` +${lrNumbers.length - 2}` : '';

        return <span className="text-sm font-medium text-primary-700">{preview}{suffix}</span>;
      },
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
        total={total}
        page={page}
        pageSize={20}
        isLoading={isLoading}
        onPageChange={setPage}
        onRefresh={() => refetch()}
        onRowClick={(row) => setSelectedTripId(row.id)}
        emptyMessage="No trips assigned"
      />

      <Modal
        isOpen={Boolean(selectedTripId)}
        onClose={() => setSelectedTripId(null)}
        title={tripDetail?.trip_number ? `Trip ${tripDetail.trip_number}` : 'Trip Details'}
        subtitle="Tap Complete Trip after reaching destination"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSelectedTripId(null)}>
              Close
            </button>
            {canComplete && (
              <button
                className="btn-primary"
                disabled={completeMutation.isPending || !selectedTripId}
                onClick={() => selectedTripId && completeMutation.mutate(selectedTripId)}
              >
                {completeMutation.isPending ? 'Completing...' : 'Complete Trip'}
              </button>
            )}
          </>
        }
      >
        {detailQuery.isLoading && <p className="text-sm text-gray-500">Loading trip details...</p>}

        {!detailQuery.isLoading && tripDetail && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">Status</p>
              <StatusBadge status={tripDetail.status} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500">Origin</p>
                <p className="font-medium text-gray-900">{tripDetail.origin || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Destination</p>
                <p className="font-medium text-gray-900">{tripDetail.destination || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Trip Date</p>
                <p className="font-medium text-gray-900">{tripDetail.trip_date ? new Date(tripDetail.trip_date).toLocaleDateString('en-IN') : '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Vehicle</p>
                <p className="font-medium text-gray-900">{tripDetail.vehicle_registration || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">LR Count</p>
                <p className="font-medium text-gray-900">{tripDetail.lr_count ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-500">LR Numbers</p>
                <p className="font-medium text-gray-900">
                  {tripDetail.lr_numbers?.length ? tripDetail.lr_numbers.join(', ') : '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Planned Start</p>
                <p className="font-medium text-gray-900">{formatDateTime(tripDetail.planned_start)}</p>
              </div>
              <div>
                <p className="text-gray-500">Planned End</p>
                <p className="font-medium text-gray-900">{formatDateTime(tripDetail.planned_end)}</p>
              </div>
              <div>
                <p className="text-gray-500">Actual Start</p>
                <p className="font-medium text-gray-900">{formatDateTime(tripDetail.actual_start)}</p>
              </div>
              <div>
                <p className="text-gray-500">Actual End</p>
                <p className="font-medium text-gray-900">{formatDateTime(tripDetail.actual_end)}</p>
              </div>
              <div>
                <p className="text-gray-500">Planned Distance (km)</p>
                <p className="font-medium text-gray-900">{tripDetail.planned_distance_km ?? '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Actual Distance (km)</p>
                <p className="font-medium text-gray-900">{tripDetail.actual_distance_km ?? '-'}</p>
              </div>
            </div>

            {!!tripDetail.lr_details?.length && (
              <div>
                <p className="text-gray-500 mb-2">LR Details</p>
                <div className="space-y-2">
                  {tripDetail.lr_details.map((lr) => (
                    <div key={lr.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-gray-900">{lr.lr_number || `LR #${lr.id}`}</p>
                        {lr.status && <StatusBadge status={lr.status} />}
                      </div>
                      <p className="text-gray-600 mt-1">
                        {lr.origin || '-'} {'->'} {lr.destination || '-'}
                      </p>
                      <p className="text-gray-600 mt-1">
                        Consignee: <span className="font-medium text-gray-900">{lr.consignee_name || '-'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tripDetail.remarks && (
              <div>
                <p className="text-gray-500">Remarks</p>
                <p className="font-medium text-gray-900 whitespace-pre-wrap">{tripDetail.remarks}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
