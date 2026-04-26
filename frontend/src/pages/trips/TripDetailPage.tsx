import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripService, financeService, lrService } from '@/services/dataService';
import { StatusBadge, LoadingPage, Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/store/authStore';
import { safeArray, openDocumentUrl } from '@/utils/helpers';
import { useRealtimeTrip } from '@/services/useRealtimeDashboard';
import {
  ArrowLeft, Play, Square, MapPin, Fuel, DollarSign, Navigation,
  ChevronRight, Clock, FileText, Truck, User, IndianRupee, ExternalLink, Receipt, Image, Paperclip, X, Upload, CheckCircle,
  Calendar, Tag, Hash, CreditCard, BadgeCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();

  // Lightbox state
  const [viewDoc, setViewDoc] = useState<{ url: string; title: string } | null>(null);
  // Expense detail drawer
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  // POD upload per LR
  const podFileRefs = useRef<{ [lrId: number]: HTMLInputElement | null }>({});
  const uploadPODMutation = useMutation({
    mutationFn: ({ lrId, file }: { lrId: number; file: File }) => lrService.uploadPOD(lrId, file),
    onSuccess: () => {
      toast.success('POD uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['trip-lrs', id] });
    },
    onError: () => toast.error('Failed to upload POD'),
  });
  const verifyPODMutation = useMutation({
    mutationFn: (lrId: number) => lrService.verifyPOD(lrId),
    onSuccess: () => {
      toast.success('POD verified');
      queryClient.invalidateQueries({ queryKey: ['trip-lrs', id] });
    },
    onError: () => toast.error('Failed to verify POD'),
  });

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripService.get(Number(id)),
    enabled: !!id,
  });

  // Subscribe to live trip updates via WebSocket
  useRealtimeTrip(id ? Number(id) : null);

  const { data: expensesData } = useQuery({
    queryKey: ['trip-expenses', id],
    queryFn: () => tripService.getExpenses(Number(id)),
    enabled: !!id,
  });

  const { data: tripLRs = [] } = useQuery({
    queryKey: ['trip-lrs', id],
    queryFn: () => tripService.getTripLRs(Number(id)),
    enabled: !!id,
  });

  const { data: tripInvoices = [] } = useQuery({
    queryKey: ['trip-invoices', id],
    queryFn: () => tripService.getTripInvoices(Number(id)),
    enabled: !!id,
  });

  const { data: fuelEntries = [] } = useQuery({
    queryKey: ['trip-fuel', id],
    queryFn: () => tripService.getFuelEntries(Number(id)),
    enabled: !!id,
  });

  const { data: preChecklist } = useQuery({
    queryKey: ['trip-checklist-pre', id],
    queryFn: () => tripService.getChecklist(Number(id), 'checklist'),
    enabled: !!id,
    retry: false,
  });

  const { data: tripDocuments = [] } = useQuery({
    queryKey: ['trip-documents', id],
    queryFn: () => tripService.getTripDocuments(Number(id)),
    enabled: !!id,
  });

  const { data: tripPhotos = [] } = useQuery({
    queryKey: ['trip-photos', id],
    queryFn: () => tripService.getTripPhotos(Number(id)),
    enabled: !!id,
  });

  const expenses = safeArray<any>(expensesData);

  // Helper: resolve file URL to the API server
  const fileUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('data:')) return url; // base64 data URIs stay as-is
    const clean = url.replace(/^https?:\/\/localhost:\d+/, 'https://api.kavyatransports.com');
    return clean.startsWith('http') ? clean : `https://api.kavyatransports.com${clean}`;
  };

  // Helper: parse UTC timestamp — backend stores naive UTC (no "Z"), JS would treat it
  // as local time without this fix. Append "Z" so it's correctly treated as UTC → IST.
  const parseTs = (ts: string | null | undefined): Date | null => {
    if (!ts) return null;
    const s = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z';
    return new Date(s);
  };
  const fmtTs = (ts: string | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
    const d = parseTs(ts);
    if (!d) return '';
    return d.toLocaleString('en-IN', opts ?? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const startMutation = useMutation({
    mutationFn: () => tripService.start(Number(id), { start_odometer: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', id] }),
  });

  const completeMutation = useMutation({
    mutationFn: () => tripService.complete(Number(id), { end_odometer: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', id] }),
  });

  const approvePaymentMutation = useMutation({
    mutationFn: () => tripService.approvePayment(Number(id)),
    onSuccess: () => {
      toast.success('Payment approved and queued for accountant');
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
    onError: () => toast.error('Failed to approve payment'),
  });



  if (isLoading) return <LoadingPage />;
  if (!trip) return <div className="text-center py-16 text-gray-400">Trip not found</div>;

  // Status history helpers — to_status is stored lowercase in DB
  const statusHistory = (trip.status_history || []) as any[];
  const getStatusRecord = (toStatus: string) =>
    statusHistory.find(h => (h.to_status || '') === toStatus) ?? null;

  // Document chip — shows thumbnail for images, PDF icon for docs; clicks open lightbox
  const DocChip = ({ url, label }: { url: string; label: string }) => {
    const resolvedUrl = fileUrl(url) || url;
    const isImg = /\.(jpe?g|png|gif|webp|heic)$/i.test(resolvedUrl) || resolvedUrl.startsWith('data:image');
    return (
      <button
        onClick={() => setViewDoc({ url: resolvedUrl, title: label })}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium shadow-sm"
      >
        {isImg
          ? <img src={resolvedUrl} alt={label} className="w-5 h-5 object-cover rounded" />
          : <FileText size={13} className="text-red-500 flex-shrink-0" />
        }
        <span className="max-w-[120px] truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Document Lightbox */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={() => setViewDoc(null)}>
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="font-semibold text-sm text-gray-900">{viewDoc.title}</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => openDocumentUrl(viewDoc.url)} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> Open in new tab
                </button>
                <button onClick={() => setViewDoc(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center bg-gray-50">
              {/\.(jpe?g|png|gif|webp|heic)$/i.test(viewDoc.url) ? (
                <img src={viewDoc.url} alt={viewDoc.title} className="max-w-full max-h-[80vh] object-contain p-2" />
              ) : (
                <iframe src={viewDoc.url} className="w-full h-[80vh] border-0" title={viewDoc.title} />
              )}
            </div>
          </div>
        </div>
      )}
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <Link to="/trips">Trips</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <span className="text-gray-900 font-medium">{trip.trip_number}</span>
      </nav>
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/trips')} className="btn-icon"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{trip.trip_number}</h1>
            <StatusBadge status={trip.status} />
          </div>
          <p className="text-gray-500">
            {trip.vehicle?.registration_number} | Driver: {trip.driver?.full_name}
          </p>
        </div>
        <div className="flex gap-2">
          {trip.status === 'planned' && hasPermission('trips:update') && (
            <button onClick={() => startMutation.mutate()} className="btn-success flex items-center gap-2" disabled={startMutation.isPending}>
              <Play size={16} /> Start Trip
            </button>
          )}
          {['started', 'in_transit'].includes(trip.status) && (
            <button onClick={() => completeMutation.mutate()} className="btn-danger flex items-center gap-2" disabled={completeMutation.isPending}>
              <Square size={16} /> Complete Trip
            </button>
          )}
          {trip.status === 'completed' && !trip.payment_approved && hasPermission('trips:update') && (
            <button 
              onClick={() => approvePaymentMutation.mutate()} 
              className="btn-success flex items-center gap-2" 
              disabled={approvePaymentMutation.isPending}
            >
              <DollarSign size={16} /> Approve Payment · ₹{((trip.driver_pay || 0)).toLocaleString('en-IN')}
            </button>
          )}
          {['started', 'in_transit'].includes(trip.status) && (
            <button onClick={() => navigate('/tracking')} className="btn-primary flex items-center gap-2">
              <Navigation size={16} /> Track Live
            </button>
          )}
        </div>
      </div>

      {/* LR Details — Consignor/Consignee → Items → Route+Eway/Freight/POD */}
      {((tripLRs as any[]).length > 0) && (
        <div className="space-y-5">
          {(tripLRs as any[]).map((lr: any) => (
            <div key={lr.id} className="space-y-4">
              {/* Consignor / Consignee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Consignor</h4>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-gray-900">{lr.consignor_name || '—'}</p>
                    {lr.consignor_address && <p className="text-gray-500 text-xs">{lr.consignor_address}</p>}
                    {lr.consignor_gstin && <p className="text-gray-400 text-xs">GST: {lr.consignor_gstin}</p>}
                  </div>
                </div>
                <div className="card">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Consignee</h4>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-gray-900">{lr.consignee_name || '—'}</p>
                    {lr.consignee_address && <p className="text-gray-500 text-xs">{lr.consignee_address}</p>}
                    {lr.consignee_gstin && <p className="text-gray-400 text-xs">GST: {lr.consignee_gstin}</p>}
                  </div>
                </div>
              </div>

              {/* Items table */}
              {lr.items && lr.items.length > 0 && (
                <div className="card p-0">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h4 className="font-semibold text-gray-900 text-sm">Items</h4>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="table-header">Description</th>
                        <th className="table-header">Packages</th>
                        <th className="table-header">Actual Weight</th>
                        <th className="table-header">Charged Weight</th>
                        <th className="table-header text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lr.items.map((item: any, idx: number) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="table-cell">
                            <div className="font-medium">{item.description}</div>
                            {item.hsn_code && <div className="text-xs text-gray-400">HSN: {item.hsn_code}</div>}
                            {item.package_type && <div className="text-xs text-gray-400">{item.package_type}</div>}
                          </td>
                          <td className="table-cell">{item.packages ?? '—'}</td>
                          <td className="table-cell">{item.actual_weight != null ? `${item.actual_weight} kg` : '—'}</td>
                          <td className="table-cell">{item.charged_weight != null ? `${item.charged_weight} kg` : '—'}</td>
                          <td className="table-cell text-right font-semibold text-gray-900">
                            {idx === 0 ? `₹${Number(lr.total_freight || lr.freight_amount || 0).toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Route & E-way Bill / Freight Details / POD Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Route & E-way Bill</h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Origin</span><span className="font-medium">{lr.origin || trip.origin || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Destination</span><span className="font-medium">{lr.destination || trip.destination || '—'}</span></div>
                    {lr.eway_bill_number
                      ? <div className="flex justify-between"><span className="text-gray-500">E-way Bill</span><span className="font-mono text-xs">{lr.eway_bill_number}</span></div>
                      : <div className="flex justify-between"><span className="text-gray-500">E-way Bill</span><span className="text-gray-400 italic text-xs">Not added</span></div>
                    }
                    {lr.eway_bill_expiry && (
                      <div className="flex justify-between"><span className="text-gray-500">EWB Expiry</span><span className="text-xs">{fmtTs(lr.eway_bill_expiry, { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                    )}
                  </div>
                </div>
                <div className="card">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Freight Details</h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Freight Amount</span><span className="font-semibold">₹{Number(lr.freight_amount || 0).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Weight</span><span>{lr.total_weight || (lr.items?.reduce((s: number, i: any) => s + parseFloat(i.actual_weight || 0), 0) || null) ? `${lr.total_weight || lr.items?.reduce((s: number, i: any) => s + parseFloat(i.actual_weight || 0), 0)} kg` : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Packages</span><span>{lr.total_packages || lr.items?.reduce((s: number, i: any) => s + (i.packages || 0), 0) || '—'}</span></div>
                  </div>
                </div>
                <div className="card">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">POD Status</h4>
                  <div className="flex flex-col items-center py-3">
                    {String(lr.status).toLowerCase() === 'pod_received' ? (
                      <>
                        <div className="w-full">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <CheckCircle size={15} className="text-green-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-green-700 text-sm leading-tight">POD Received</p>
                              {lr.pod_date && <p className="text-xs text-gray-400">{fmtTs(lr.pod_date, { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                            </div>
                          </div>
                          {lr.pod_file_url && (
                            <button
                              onClick={() => setViewDoc({ url: fileUrl(lr.pod_file_url)!, title: `POD — ${lr.lr_number}` })}
                              className="w-full mt-1 rounded-lg overflow-hidden border border-green-200 hover:border-green-400 transition-colors group relative"
                            >
                              {/\.(jpe?g|png|gif|webp|heic)$/i.test(lr.pod_file_url) ? (
                                <img
                                  src={fileUrl(lr.pod_file_url)!}
                                  alt="POD Photo"
                                  className="w-full h-36 object-cover group-hover:opacity-90 transition-opacity"
                                />
                              ) : (
                                <div className="w-full h-20 flex flex-col items-center justify-center bg-green-50 gap-1">
                                  <FileText size={28} className="text-green-400" />
                                  <span className="text-xs text-green-600">View POD Document</span>
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity rounded-lg">
                                <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to view</span>
                              </div>
                            </button>
                          )}
                        </div>
                      </>
                    ) : lr.pod_uploaded || lr.pod_file_url ? (
                      <>
                        <div className="w-full">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <FileText size={15} className="text-amber-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-amber-700 text-sm leading-tight">POD Uploaded</p>
                              <p className="text-xs text-gray-400">Awaiting confirmation</p>
                            </div>
                          </div>
                          {lr.pod_file_url && (
                            <button
                              onClick={() => setViewDoc({ url: fileUrl(lr.pod_file_url)!, title: `POD — ${lr.lr_number}` })}
                              className="w-full mt-1 rounded-lg overflow-hidden border border-amber-200 hover:border-amber-400 transition-colors group relative"
                            >
                              {/\.(jpe?g|png|gif|webp|heic)$/i.test(lr.pod_file_url) ? (
                                <img
                                  src={fileUrl(lr.pod_file_url)!}
                                  alt="POD Photo"
                                  className="w-full h-36 object-cover group-hover:opacity-90 transition-opacity"
                                />
                              ) : (
                                <div className="w-full h-20 flex flex-col items-center justify-center bg-amber-50 gap-1">
                                  <FileText size={28} className="text-amber-400" />
                                  <span className="text-xs text-amber-600">View POD Document</span>
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity rounded-lg">
                                <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to view</span>
                              </div>
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                          <Upload size={24} className="text-gray-400" />
                        </div>
                        <p className="font-semibold text-gray-500 text-sm">POD Pending</p>
                        <p className="text-xs text-gray-400 mt-0.5 mb-3">Driver or fleet manager can upload</p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          ref={el => { podFileRefs.current[lr.id] = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) uploadPODMutation.mutate({ lrId: lr.id, file });
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => podFileRefs.current[lr.id]?.click()}
                          disabled={uploadPODMutation.isPending}
                          className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                        >
                          <Upload size={12} />
                          {uploadPODMutation.isPending ? 'Uploading...' : 'Upload POD'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Separator between multiple LRs */}
              {(tripLRs as any[]).length > 1 && <hr className="border-gray-100" />}
            </div>
          ))}
        </div>
      )}

      {/* Trip Progress Stepper */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-5">Trip Progress</h3>        <div className="flex">
          {['planned', 'started', 'loading', 'in_transit', 'unloading', 'completed'].map((stepKey, i) => {
            const LABELS: Record<string, string> = {
              planned: 'Planned', started: 'Started', loading: 'Loading',
              in_transit: 'In Transit', unloading: 'Unloading', completed: 'Completed',
            };
            const ORDER = ['planned', 'started', 'loading', 'in_transit', 'unloading', 'completed'];
            const currentIdx = ORDER.indexOf((trip.status || '').toLowerCase());
            const isCompleted = (trip.status || '').toLowerCase() === 'completed';
            const done = i < currentIdx || (isCompleted && i === currentIdx);
            const active = i === currentIdx && !isCompleted;
            const record = getStatusRecord(stepKey);
            const ts = record?.created_at ?? null;
            return (
              <div key={stepKey} style={{ flex: 1, minWidth: 0 }} className="flex flex-col items-center">
                <div className="flex items-center w-full">
                  <div className={`flex-1 h-0.5 ${i === 0 ? 'invisible' : done ? 'bg-green-400' : 'bg-gray-200'}`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                    done ? 'bg-green-500 border-green-500 text-white' :
                    active ? 'bg-primary-600 border-primary-600 text-white ring-4 ring-primary-100' :
                    'bg-white border-gray-200 text-gray-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div className={`flex-1 h-0.5 ${i === 5 ? 'invisible' : done ? 'bg-green-400' : 'bg-gray-200'}`} />
                </div>
                <p className={`text-xs font-medium mt-1.5 text-center px-0.5 ${done || active ? 'text-gray-800' : 'text-gray-400'}`}>
                  {LABELS[stepKey]}
                </p>
                {ts ? (
                  <p className="text-[10px] text-gray-400 text-center leading-snug mt-0.5 px-0.5">
                    {fmtTs(ts)}
                  </p>
                ) : active ? (
                  <p className="text-[10px] text-primary-500 font-medium text-center mt-0.5">● Live</p>
                ) : i > currentIdx ? (
                  <p className="text-[10px] text-gray-300 text-center mt-0.5">Pending</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase Photos — loaded, reached, unloaded, POD from driver app */}
      {(() => {
        const t = trip as any;
        const baseUrl = 'https://api.kavyatransports.com';
        const resolveUrl = (u: string | null | undefined) => {
          if (!u) return null;
          const clean = u.replace(/^https?:\/\/localhost:\d+/, 'https://api.kavyatransports.com');
          return clean.startsWith('http') ? clean : `${baseUrl}${clean}`;
        };
        type Phase = { label: string; url: string | null; icon: string; color: string };
        const phases: Phase[] = [
          { label: 'Loaded', url: resolveUrl(t.loaded_image_url), icon: '📦', color: 'blue' },
          { label: 'Reached', url: resolveUrl(t.reached_image_url), icon: '📍', color: 'amber' },
          { label: 'Unloaded', url: resolveUrl(t.unloaded_image_url), icon: '🏭', color: 'purple' },
          { label: 'Proof of Delivery', url: resolveUrl(t.pod_image_url), icon: '✅', color: 'green' },
        ];
        const hasAny = phases.some(p => !!p.url);
        if (!hasAny) return null;
        return (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Image size={16} className="text-primary-500" /> Trip Phase Photos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {phases.map(phase => (
                <div key={phase.label} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <span>{phase.icon}</span> {phase.label}
                  </p>
                  {phase.url ? (
                    <button
                      onClick={() => setViewDoc({ url: phase.url!, title: phase.label })}
                      className={`rounded-xl overflow-hidden border-2 border-${phase.color}-200 hover:border-${phase.color}-400 transition-all group relative`}
                    >
                      {/\.(jpe?g|png|gif|webp|heic)$/i.test(phase.url) ? (
                        <img src={phase.url} alt={phase.label} className="w-full h-32 object-cover group-hover:opacity-90 transition-opacity" />
                      ) : (
                        <div className={`w-full h-32 flex flex-col items-center justify-center bg-${phase.color}-50 gap-1`}>
                          <FileText size={28} className={`text-${phase.color}-400`} />
                          <span className={`text-xs text-${phase.color}-600`}>View Document</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity rounded-xl">
                        <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to view</span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 bg-gray-50">
                      <span className="text-2xl opacity-30">{phase.icon}</span>
                      <span className="text-xs text-gray-400">Not yet uploaded</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Journey Timeline & Distance Progress */}
      {(() => {
        const t = trip as any;
        const plannedKm: number = parseFloat(t.planned_distance_km || t.total_distance || 0);
        const actualKm: number = parseFloat(t.actual_distance_km || 0);
        const startOdo: number = parseFloat(t.start_odometer || 0);
        const currentOdo: number = parseFloat(t.end_odometer || t.start_odometer || 0);
        const travelledKm: number = startOdo && currentOdo > startOdo ? currentOdo - startOdo : actualKm;
        const pct: number = plannedKm > 0 ? Math.min(100, Math.round((travelledKm / plannedKm) * 100)) : 0;
        const remainingKm: number = Math.max(0, plannedKm - travelledKm);
        const tripStarted = ['started','loading','in_transit','unloading','completed'].includes((t.status || '').toLowerCase());
        const tripCompleted = (t.status || '').toLowerCase() === 'completed';

        const routeDetail = (t.route_detail || null) as any;
        const viaPoints: string[] = routeDetail?.via_points
          ? routeDetail.via_points.map((v: any) => typeof v === 'string' ? v : (v.name || v.city || String(v)))
          : [];

        // Logged checkpoints from status_history that have a location_name (excluding origin/destination)
        const loggedCheckpoints = statusHistory
          .filter(h => h.location_name &&
            !(t.origin || '').toLowerCase().includes(h.location_name.toLowerCase()) &&
            !h.location_name.toLowerCase().includes((t.origin || '').toLowerCase()) &&
            !(t.destination || '').toLowerCase().includes(h.location_name.toLowerCase()) &&
            !h.location_name.toLowerCase().includes((t.destination || '').toLowerCase())
          )
          .map(h => ({ city: h.location_name as string, ts: h.created_at as string | null }));

        interface StopNode { city: string; type: 'origin' | 'destination' | 'via' | 'checkpoint'; ts: string | null; isLogged: boolean }

        // Via points — mark as logged if a checkpoint name matches them
        const viaNodes: StopNode[] = viaPoints.map(city => {
          const match = loggedCheckpoints.find(c =>
            c.city.toLowerCase().includes(city.toLowerCase()) ||
            city.toLowerCase().includes(c.city.toLowerCase())
          );
          return { city, type: 'via', ts: match?.ts ?? null, isLogged: !!match };
        });

        // Extra checkpoints not matching any via_point (unplanned stops)
        const extraCheckpoints: StopNode[] = loggedCheckpoints
          .filter(c => !viaNodes.some(v =>
            v.city.toLowerCase().includes(c.city.toLowerCase()) ||
            c.city.toLowerCase().includes(v.city.toLowerCase())
          ))
          .map(c => ({ city: c.city, type: 'checkpoint' as const, ts: c.ts, isLogged: true }));

        // Merge middle stops; logged ones sort to match journey order by timestamp
        const middle: StopNode[] = [...viaNodes, ...extraCheckpoints].sort((a, b) => {
          if (a.ts && b.ts) return (parseTs(a.ts)?.getTime() ?? 0) - (parseTs(b.ts)?.getTime() ?? 0);
          if (a.ts) return -1;
          if (b.ts) return 1;
          return 0;
        });

        const allStops: StopNode[] = ([
          { city: t.origin || '', type: 'origin' as const, ts: t.actual_start ?? null, isLogged: !!t.actual_start },
          ...middle,
          { city: t.destination || '', type: 'destination' as const, ts: t.actual_end ?? null, isLogged: !!t.actual_end },
        ] as StopNode[]).filter(s => s.city);

        const N = allStops.length - 1; // total segments
        const estHoursPerSeg = routeDetail?.estimated_hours && N > 0 ? routeDetail.estimated_hours / N : null;
        const estKmPerSeg = plannedKm > 0 && N > 0 ? Math.round(plannedKm / N) : null;

        // Segment travel time (actual) between consecutive stops
        const segmentMins: (number | null)[] = allStops.map((stop, idx) => {
          if (idx === 0) return null;
          const prev = allStops[idx - 1];
          if (!prev.ts || !stop.ts) return null;
          const diff = (parseTs(stop.ts)?.getTime() ?? 0) - (parseTs(prev.ts)?.getTime() ?? 0);
          return diff > 0 ? Math.round(diff / 60000) : null;
        });

        // Total elapsed
        const nowTs = tripCompleted && t.actual_end ? t.actual_end : new Date().toISOString();
        const elapsedMins: number | null = t.actual_start
          ? Math.round(((parseTs(nowTs)?.getTime() ?? 0) - (parseTs(t.actual_start)?.getTime() ?? 0)) / 60000)
          : null;

        const firstPendingIdx = allStops.findIndex((s, i) => i > 0 && !s.ts);

        const fmtMins = (m: number) => m >= 60
          ? `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`
          : `${m}m`;

        return (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <Navigation size={18} /> Journey Progress
            </h3>

            {/* Distance Progress Bar */}
            {plannedKm > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-medium text-gray-700">Distance Covered</span>
                  <span className="font-bold text-primary-600">{pct}% completed</span>
                </div>
                <div className="relative w-full h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: pct >= 80 ? '#16a34a' : pct >= 40 ? '#2563eb' : '#f59e0b' }}
                  />
                  {pct > 10 && (
                    <span className="absolute left-2 top-0 h-full flex items-center text-[10px] font-bold text-white">
                      {travelledKm.toFixed(0)} km
                    </span>
                  )}
                  {pct <= 10 && travelledKm > 0 && (
                    <span className="absolute right-2 top-0 h-full flex items-center text-[10px] text-gray-500">
                      {travelledKm.toFixed(0)} km
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                  <span className="font-medium text-gray-600">{t.origin}</span>
                  <span>{remainingKm > 0 ? `${remainingKm.toFixed(0)} km left of ${plannedKm} km` : `${plannedKm} km · Reached`}</span>
                  <span className="font-medium text-gray-600">{t.destination}</span>
                </div>
              </div>
            )}

            {/* Route timeline */}
            <div className="relative">
              <div className="absolute left-[9px] top-5 bottom-5 w-0.5 bg-gray-200" />
              {allStops.map((stop, idx) => {
                const isOrigin = stop.type === 'origin';
                const isDest = stop.type === 'destination';
                const segMins = segmentMins[idx];
                const isEnRoute = !stop.ts && tripStarted && idx === firstPendingIdx;
                const estMins = estHoursPerSeg ? Math.round(estHoursPerSeg * 60) : null;

                const dotCls = isDest
                  ? (stop.ts ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300')
                  : isOrigin
                    ? (stop.ts ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300')
                    : (stop.isLogged ? 'bg-primary-500 border-primary-500' : isEnRoute ? 'bg-amber-400 border-amber-400 ring-2 ring-amber-100' : 'bg-white border-gray-300');

                return (
                  <div key={idx}>
                    {/* Segment connector */}
                    {idx > 0 && (
                      <div className="flex items-center pl-8 py-2 gap-2">
                        {segMins !== null ? (
                          <span className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1 shadow-sm flex items-center gap-1.5">
                            <Clock size={11} className="text-primary-500" />
                            {fmtMins(segMins)}
                            {estKmPerSeg && <span className="text-gray-400 font-normal">· ~{estKmPerSeg} km</span>}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                            <Clock size={10} className="text-gray-300" />
                            {estMins ? `~${fmtMins(estMins)} est.` : '— hrs'}
                            {estKmPerSeg && <span className="text-gray-300">· ~{estKmPerSeg} km</span>}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Stop row */}
                    <div className="flex items-center gap-3">
                      <div className={`relative z-10 w-5 h-5 rounded-full border-2 flex-shrink-0 ${dotCls}`} />
                      <div className="flex-1 flex items-center justify-between min-w-0 py-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className={`text-sm font-semibold truncate ${stop.ts || isOrigin ? 'text-gray-800' : 'text-gray-400'}`}>
                            {stop.city}
                          </span>
                          {isOrigin && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Origin</span>}
                          {isDest && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Destination</span>}
                          {stop.type === 'checkpoint' && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Stop</span>}
                          {stop.type === 'via' && !stop.ts && !isEnRoute && <span className="text-[10px] text-gray-400 flex-shrink-0">Planned</span>}
                          {isEnRoute && <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex-shrink-0">● En Route</span>}
                        </div>
                        <span className={`text-[11px] flex-shrink-0 ml-2 ${stop.ts ? 'text-gray-400' : 'text-gray-300'}`}>
                          {stop.ts
                            ? fmtTs(stop.ts)
                            : isEnRoute ? '' : 'Pending'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Summary */}
            {tripStarted && (
              <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 rounded-lg py-2.5 px-2">
                  <p className="text-[11px] text-gray-400 mb-0.5">Total Time</p>
                  <p className="text-sm font-bold text-gray-800">
                    {elapsedMins !== null ? fmtMins(elapsedMins) : '—'}
                  </p>
                  {routeDetail?.estimated_hours && (
                    <p className="text-[10px] text-gray-400 mt-0.5">Est. {fmtMins(Math.round(routeDetail.estimated_hours * 60))}</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg py-2.5 px-2">
                  <p className="text-[11px] text-gray-400 mb-0.5">Distance</p>
                  <p className="text-sm font-bold text-gray-800">
                    {travelledKm > 0 ? `${travelledKm.toFixed(0)} km` : '—'}
                  </p>
                  {plannedKm > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">of {plannedKm} km planned</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg py-2.5 px-2">
                  <p className="text-[11px] text-gray-400 mb-0.5">{tripCompleted ? 'Arrived' : 'ETA'}</p>
                  <p className="text-sm font-bold text-gray-800">
                    {tripCompleted && t.actual_end
                      ? fmtTs(t.actual_end)
                      : routeDetail?.estimated_hours && t.actual_start
                        ? new Date((parseTs(t.actual_start)?.getTime() ?? 0) + routeDetail.estimated_hours * 3600_000)
                            .toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                        : '—'
                    }
                  </p>
                  {!tripCompleted && routeDetail?.estimated_hours && (
                    <p className="text-[10px] text-gray-400 mt-0.5">based on {routeDetail.estimated_hours}h est.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Vehicle & Driver */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Truck size={18} /> Vehicle</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Registration</span><span className="font-medium">{trip.vehicle?.registration_number || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span>{trip.vehicle?.vehicle_type || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Make / Model</span><span>{[trip.vehicle?.make, trip.vehicle?.model].filter(Boolean).join(' ') || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Capacity</span><span>{trip.vehicle?.capacity_tons ? `${trip.vehicle.capacity_tons} T` : '—'}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><User size={18} /> Driver</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{trip.driver?.full_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{trip.driver?.phone || '—'}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">License No.</span>
              {trip.driver?.license_number
                ? <span>{trip.driver.license_number}</span>
                : <Link to={`/drivers/${trip.driver_id}`} className="text-xs text-primary-600 hover:underline">Not added — Add in driver profile</Link>
              }
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Driver Pay</span><span className="font-medium">₹{Number(trip.driver_pay || 0).toLocaleString('en-IN')}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><MapPin size={18} /> Route</h3>
          <div className="space-y-3 text-sm">
            <div><p className="text-gray-500 text-xs">Origin</p><p className="font-medium">{trip.origin}</p></div>
            <div></div>
            <div><p className="text-gray-500 text-xs">Destination</p><p className="font-medium">{trip.destination}</p></div>
            <hr />
            <div className="flex justify-between"><span className="text-gray-500">Distance</span><span>{(() => { const t = trip as any; const db = parseFloat(t.actual_distance_km || t.planned_distance_km || t.total_distance || 0); const startOdo = parseFloat(t.start_odometer || 0); const endOdo = parseFloat(t.end_odometer || 0); const odo = startOdo && endOdo > startOdo ? endOdo - startOdo : 0; const d = db || odo; return d > 0 ? `${d.toFixed(0)} km` : '—'; })()}</span></div>
            {trip.actual_start && <div className="flex justify-between"><span className="text-gray-500">Actual Start</span><span>{fmtTs(trip.actual_start, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>}
            {trip.actual_end && <div className="flex justify-between"><span className="text-gray-500">Actual End</span><span>{fmtTs(trip.actual_end, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Fuel size={18} /> Fuel & Odometer</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Start Odometer</span><span>{trip.start_odometer || '—'} km</span></div>
            <div className="flex justify-between"><span className="text-gray-500">End Odometer</span><span>{trip.end_odometer || '—'} km</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fuel Issued</span><span>{trip.fuel_issued || '—'} L</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fuel Consumed</span><span>{trip.fuel_consumed || '—'} L</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fuel Cost</span><span>₹{Number((trip.total_fuel_cost || 0) ?? 0).toLocaleString('en-IN')}</span></div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><DollarSign size={18} /> Financials</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total Expenses</span><span>₹{Number((trip.total_expenses || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="text-green-600 font-medium">₹{Number((trip.revenue || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <hr />
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Profit</span><span className={`font-bold ${(trip.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{Number((trip.profit || 0) ?? 0).toLocaleString('en-IN')}</span></div>
          </div>
          {/* Driver Advance Payment Status */}
          {(trip as any).loaded_image_url && (
            <div className={`mt-4 rounded-lg px-3 py-2.5 text-sm flex items-start gap-2 ${(trip as any).advance_paid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              {(trip as any).advance_paid ? (
                <>
                  <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-green-800">
                    <p className="font-semibold">Advance Paid — ₹1,500</p>
                    <p className="text-xs mt-0.5">
                      Paid by Finance Manager {(trip as any).advance_paid_by_name || '—'}
                      {(trip as any).advance_paid_at
                        ? ` on ${fmtTs((trip as any).advance_paid_at, { day: '2-digit', month: 'short', year: 'numeric' })}`
                        : ''}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <BadgeCheck size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-amber-800">
                    <p className="font-semibold">Advance Pending</p>
                    <p className="text-xs mt-0.5">Loading photo uploaded — Finance Manager needs to pay ₹1,500 advance.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Driver Activity */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2"><Clock size={18} /> Driver Activity</h3>
        <div className="relative pl-10">
          <div className="absolute left-3 top-1 bottom-1 w-0.5 bg-gray-100" />

          {/* LR & E-way Bills */}
          {(() => {
            const lrs = ((trip as any).lrs || tripLRs || []) as any[];
            const firstTs = lrs[0]?.created_at ?? (trip as any).created_at;
            return (
              <div className="relative pb-5">
                <div className="absolute -left-10 top-0 w-6 h-6 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center">
                  <FileText size={11} className="text-blue-500" />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">LR & E-way Bills</p>
                    {firstTs && <span className="text-xs text-gray-400">{fmtTs(firstTs)}</span>}
                  </div>
                  {lrs.length === 0 ? (
                    <p className="text-xs text-gray-400">No LR created yet</p>
                  ) : (
                    <div className="space-y-3 mt-1.5">
                      {lrs.map((lr: any) => (
                        <div key={lr.id || lr.lr_number}>
                          <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                            <span className="font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded">📄 {lr.lr_number}</span>
                            {lr.eway_bill_number
                              ? <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded">✓ EWB: {lr.eway_bill_number}</span>
                              : <span className="text-gray-400 italic">No e-way bill</span>
                            }
                            <span className="text-gray-400 capitalize">{(lr.status || '').toLowerCase()}</span>
                            {lr.id && (
                              <Link
                                to={`/lr/${lr.id}`}
                                className="ml-auto flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 border border-primary-200 bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded font-medium"
                              >
                                <ExternalLink size={11} /> View LR
                              </Link>
                            )}
                          </div>
                          {/* Attached documents */}
                          {((lr.documents || []).length > 0 || lr.pod_file_url) && (
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {(lr.documents || []).map((doc: any, i: number) => (
                                <DocChip
                                  key={i}
                                  url={doc.file_url}
                                  label={
                                    doc.document_type === 'eway_bill' ? 'E-way Bill' :
                                    doc.document_type === 'pod' ? 'POD' :
                                    doc.document_type === 'invoice' ? 'Invoice' :
                                    doc.document_type === 'packing_list' ? 'Packing List' :
                                    (doc.document_type || 'Document').replace(/_/g, ' ')
                                  }
                                />
                              ))}
                              {lr.pod_file_url && (
                                <DocChip url={lr.pod_file_url} label="POD Photo" />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Trip Started */}
          {(trip.actual_start || getStatusRecord('started')) && (() => {
            const record = getStatusRecord('started');
            const ts = record?.created_at ?? trip.actual_start;
            return (
              <div className="relative pb-5">
                <div className="absolute -left-10 top-0 w-6 h-6 rounded-full bg-green-50 border-2 border-green-400 flex items-center justify-center">
                  <Play size={10} className="text-green-600" />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">Trip Started</p>
                    {ts && <span className="text-xs text-gray-400">{fmtTs(ts)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {trip.start_odometer && <span>Odometer: {trip.start_odometer} km</span>}
                    {record?.location_name && <span>📍 {record.location_name}</span>}
                    <span className="text-blue-500">📱 Driver App</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Loading Checklist — show once trip has started */}
          {(trip.actual_start || getStatusRecord('started')) && (() => {
            const items = (preChecklist?.items || []) as any[];
            const submitted = !!preChecklist;
            return (
              <div className="relative pb-5">
                <div className={`absolute -left-10 top-0 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                  submitted ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-gray-300'
                }`}>
                  <span className={`text-[10px] font-bold ${submitted ? 'text-amber-600' : 'text-gray-400'}`}>✓</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">Loading Checklist</p>
                    {submitted && preChecklist.completed_at
                      ? <span className="text-xs text-gray-400">{fmtTs(preChecklist.completed_at)}</span>
                      : <span className="text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 px-2 py-0.5 rounded-full">⏳ Awaiting driver</span>
                    }
                  </div>
                  {submitted ? (
                    <>
                      <div className="flex items-center gap-3 mb-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${preChecklist.ok_count === preChecklist.total_items ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {preChecklist.ok_count}/{preChecklist.total_items} completed
                        </span>
                        <span className="text-xs text-blue-500">📱 Driver App</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {items.map((item: any) => (
                          <div key={item.id} className={`text-xs flex items-start gap-1.5 ${item.checked ? 'text-gray-600' : 'text-red-500'}`}>
                            <span className="mt-0.5 flex-shrink-0">{item.checked ? '✓' : '✗'}</span>
                            <span className="flex-1">{item.label}</span>
                            {item.photo && <DocChip url={item.photo.startsWith('data:') ? item.photo : `data:image/jpeg;base64,${item.photo}`} label="Photo" />}
                          </div>
                        ))}
                      </div>
                      {preChecklist.notes && <p className="text-xs text-gray-500 mt-2 italic">Note: "{preChecklist.notes}"</p>}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">Driver has not submitted the loading checklist yet from the mobile app.</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* In Transit */}
          {getStatusRecord('in_transit') && (() => {
            const record = getStatusRecord('in_transit')!;
            return (
              <div className="relative pb-5">
                <div className="absolute -left-10 top-0 w-6 h-6 rounded-full bg-indigo-50 border-2 border-indigo-400 flex items-center justify-center">
                  <Navigation size={11} className="text-indigo-600" />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">In Transit</p>
                    {record.created_at && <span className="text-xs text-gray-400">{fmtTs(record.created_at)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>{trip.origin} → {trip.destination}</span>
                    {record.location_name && <span>📍 {record.location_name}</span>}
                    <span className="text-blue-500">📱 Driver App</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Unloading + Photos */}
          {(trip.unloading_start || getStatusRecord('unloading')) && (() => {
            const record = getStatusRecord('unloading');
            const ts = record?.created_at ?? trip.unloading_start;
            const photos = expenses.filter((e: any) => (e.category || '').toUpperCase() === 'UNLOADING');
            return (
              <div className="relative pb-5">
                <div className="absolute -left-10 top-0 w-6 h-6 rounded-full bg-orange-50 border-2 border-orange-400 flex items-center justify-center">
                  <MapPin size={11} className="text-orange-600" />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">Unloading</p>
                    {ts && <span className="text-xs text-gray-400">{fmtTs(ts)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                    {record?.location_name && <span>📍 {record.location_name}</span>}
                    {trip.unloading_end && <span>Done: {fmtTs(trip.unloading_end, { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                    <span className="text-blue-500">📱 Driver App</span>
                  </div>
                  {photos.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5 font-medium">Unloading Photos ({photos.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {photos.map((exp: any) => {
                          const url = fileUrl(exp.receipt_url);
                          const isImg = url && /\.(jpe?g|png|gif|webp|heic)$/i.test(url);
                          if (!url) return null;
                          const label = `Unloading Photo${exp.receipt_number ? ' #' + exp.receipt_number : ''}`;
                          return isImg ? (
                            <button key={exp.id} onClick={() => setViewDoc({ url, title: label })}>
                              <img src={url} alt="unloading photo" className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 cursor-zoom-in" />
                            </button>
                          ) : (
                            <button key={exp.id} onClick={() => setViewDoc({ url, title: label })} className="flex items-center gap-1 text-xs text-primary-600 hover:underline px-2 py-1 bg-white border border-gray-200 rounded">
                              <Paperclip size={12} /> File
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Unloaded Photos — driver uploads from mobile during/after unloading */}
          {(trip.unloading_start || getStatusRecord('unloading') || trip.actual_end || getStatusRecord('completed')) && (() => {
            const lrs = ((trip as any).lrs || tripLRs || []) as any[];
            const unloadingExpensePhotos = expenses
              .filter((e: any) => (e.category || '').toUpperCase() === 'UNLOADING' && (e.receipt_url || e.bill_photo_url))
              .map((e: any) => ({ url: fileUrl(e.receipt_url || e.bill_photo_url)!, label: `Unloading Photo${e.receipt_number ? ' #' + e.receipt_number : ''}` }))
              .filter((p: any) => !!p.url);
            const podPhotos = lrs
              .filter((lr: any) => lr.pod_file_url)
              .map((lr: any) => ({ url: fileUrl(lr.pod_file_url)!, label: `POD — ${lr.lr_number}` }));
            const tripUnloadedPhotos = (tripPhotos as any[])
              .filter((p: any) => p.type === 'unloaded' && p.url)
              .map((p: any) => ({ url: fileUrl(p.url)!, label: 'Unloaded' }))
              .filter((p: any) => !!p.url);
            const allPhotos = [...tripUnloadedPhotos, ...unloadingExpensePhotos, ...podPhotos];
            return (
              <div className="relative pb-5">
                <div className="absolute -left-10 top-0 w-6 h-6 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center">
                  <Image size={11} className="text-blue-500" />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">Unloaded Photos</p>
                    <span className="text-xs text-blue-500">📱 Driver App</span>
                  </div>
                  {allPhotos.length === 0 ? (
                    <p className="text-xs text-gray-400">No unloading photos uploaded yet from the mobile app.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allPhotos.map((photo: any, i: number) => {
                        const isImg = /\.(jpe?g|png|gif|webp|heic)$/i.test(photo.url) || photo.url.startsWith('data:image') || photo.url.startsWith('http');
                        return isImg ? (
                          <button key={i} onClick={() => setViewDoc({ url: photo.url, title: photo.label })} className="flex flex-col items-center gap-1">
                            <img src={photo.url} alt={photo.label} className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 cursor-zoom-in shadow-sm" />
                            <span className="text-[10px] text-gray-500 max-w-[80px] truncate">{photo.label}</span>
                          </button>
                        ) : (
                          <button key={i} onClick={() => setViewDoc({ url: photo.url, title: photo.label })} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium shadow-sm">
                            <FileText size={13} className="text-red-500" /> {photo.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Trip Completed */}
          {(trip.actual_end || getStatusRecord('completed')) && (() => {
            const record = getStatusRecord('completed');
            const ts = record?.created_at ?? trip.actual_end;
            return (
              <div className="relative">
                <div className="absolute -left-10 top-0 w-6 h-6 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center">
                  <span className="text-green-600 text-[10px] font-bold">✓</span>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-green-800">Trip Completed</p>
                    {ts && <span className="text-xs text-gray-400">{fmtTs(ts)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                    {trip.end_odometer && <span>End Odo: {trip.end_odometer} km</span>}
                    {(trip as any).actual_distance_km && <span>Distance: {(trip as any).actual_distance_km} km</span>}
                    {trip.payment_approved && <span className="text-green-600 font-medium">✓ Payment Approved</span>}
                    <span className="text-blue-500">📱 Driver App</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Empty state — only when truly nothing to show */}
          {!trip.actual_start && !getStatusRecord('started') && !preChecklist && !getStatusRecord('in_transit') && ((trip as any).lrs || tripLRs || []).length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No driver activity yet. Trip has not started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Trip Documents (LR & E-way files uploaded by driver) */}
      {(tripDocuments.length > 0 || tripPhotos.length > 0) && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Paperclip size={18} /> Driver Uploads</h3>

          {/* LR & E-way Documents */}
          {tripDocuments.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Documents</p>
              <div className="flex flex-wrap gap-2">
                {tripDocuments.map((doc: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setViewDoc({ url: fileUrl(doc.url) || '', title: `${(doc.type || 'Document').toUpperCase()} File` })}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 transition"
                  >
                    <FileText size={14} />
                    {(doc.type || 'doc').toUpperCase()} File
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trip Photos (loaded, reached, unloaded) */}
          {tripPhotos.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Trip Photos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {tripPhotos.map((photo: any, i: number) => {
                  const label = (photo.type || 'photo').charAt(0).toUpperCase() + (photo.type || 'photo').slice(1);
                  const colorMap: Record<string, string> = {
                    loaded: 'bg-amber-50 border-amber-200 text-amber-700',
                    reached: 'bg-green-50 border-green-200 text-green-700',
                    unloaded: 'bg-blue-50 border-blue-200 text-blue-700',
                  };
                  const colorClass = colorMap[photo.type] || 'bg-gray-50 border-gray-200 text-gray-700';
                  return (
                    <button
                      key={i}
                      onClick={() => setViewDoc({ url: fileUrl(photo.url) || '', title: `${label} Photo` })}
                      className={`relative rounded-lg border overflow-hidden ${colorClass} hover:opacity-80 transition`}
                    >
                      <img
                        src={fileUrl(photo.url) || ''}
                        alt={`${label} photo`}
                        className="w-full h-28 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="px-2 py-1.5 text-xs font-medium text-center">
                        <Image size={12} className="inline mr-1" />{label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expenses */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Expenses</h3>
        </div>
        {(expenses || []).length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-400">No expenses recorded</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {(expenses || []).map((exp: any) => {
              const url = fileUrl(exp.receipt_url);
              const isImage = url && /\.(jpe?g|png|gif|webp|heic)$/i.test(url);
              const isSelected = selectedExpense?.id === exp.id;
              return (
                <div
                  key={exp.id}
                  className={`px-6 py-4 flex gap-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedExpense(isSelected ? null : exp)}
                >
                  {/* Receipt thumbnail or file icon */}
                  <div className="flex-shrink-0">
                    {url ? (
                      isImage ? (
                        <button onClick={e => { e.stopPropagation(); setViewDoc({ url, title: `${String(exp.category || '').replace('_', ' ')} Receipt` }); }}>
                          <img src={url} alt="receipt" className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 cursor-zoom-in" />
                        </button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setViewDoc({ url, title: `${String(exp.category || '').replace('_', ' ')} Document` }); }} className="flex items-center justify-center w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100">
                          <Paperclip size={20} className="text-gray-400" />
                        </button>
                      )
                    ) : (
                      <div className="flex items-center justify-center w-16 h-16 rounded-lg border border-dashed border-gray-200 bg-gray-50">
                        <Image size={20} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  {/* Expense details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900 capitalize">{String(exp.category || '').replace('_', ' ')}</span>
                        {exp.sub_category && <span className="ml-2 text-xs text-gray-400">· {exp.sub_category}</span>}
                        {exp.receipt_number && <span className="ml-2 text-xs text-gray-400">#{exp.receipt_number}</span>}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap flex items-center gap-0.5"><IndianRupee size={12} />{Number(exp.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {exp.description && <p className="text-xs text-gray-500 mt-0.5">{exp.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {exp.expense_date && <span>{fmtTs(exp.expense_date, { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                      {exp.payment_mode && <span className="capitalize">{exp.payment_mode}</span>}
                      {exp.location && <span>📍 {exp.location}</span>}
                      {exp.entry_source && (
                        <span className={exp.entry_source === 'app' ? 'text-blue-500' : 'text-gray-400'}>
                          {exp.entry_source === 'app' ? '📱 Driver App' : `from ${exp.entry_source.charAt(0).toUpperCase() + exp.entry_source.slice(1)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Status badge */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {exp.is_verified
                      ? <span className="badge-success text-xs">Verified</span>
                      : <span className="badge-warning text-xs">Pending</span>
                    }
                    {exp.expense_status && exp.expense_status !== 'PENDING' && (
                      <span className="text-xs text-gray-400 capitalize">{exp.expense_status.toLowerCase()}</span>
                    )}
                    <ChevronRight size={14} className={`mt-1 transition-transform ${isSelected ? 'rotate-90 text-blue-500' : 'text-gray-300'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Expense detail expand panel ──────────────────── */}
        {selectedExpense && (
          <div className="border-t border-blue-100 bg-blue-50/30 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-800">Expense Detail</h4>
              <button onClick={() => setSelectedExpense(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {/* Category */}
              <div className="flex items-start gap-2">
                <Tag size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Category</p>
                  <p className="text-gray-900 font-medium capitalize mt-0.5">
                    {String(selectedExpense.category || '').replace('_', ' ')}
                    {selectedExpense.sub_category && <span className="text-gray-400 font-normal"> · {selectedExpense.sub_category}</span>}
                  </p>
                </div>
              </div>
              {/* Amount */}
              <div className="flex items-start gap-2">
                <IndianRupee size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Amount</p>
                  <p className="text-gray-900 font-bold mt-0.5 text-base">₹{Number(selectedExpense.amount || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
              {/* Payment Mode */}
              <div className="flex items-start gap-2">
                <CreditCard size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Payment Mode</p>
                  <p className="text-gray-900 capitalize mt-0.5">{selectedExpense.payment_mode || 'Cash'}</p>
                </div>
              </div>
              {/* Expense Date */}
              <div className="flex items-start gap-2">
                <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Expense Date</p>
                  <p className="text-gray-900 mt-0.5">
                    {selectedExpense.expense_date
                      ? fmtTs(selectedExpense.expense_date, { day: 'numeric', month: 'long', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
              </div>
              {/* Driver */}
              {selectedExpense.driver_name && (
                <div className="flex items-start gap-2">
                  <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Driver</p>
                    <p className="text-gray-900 mt-0.5">{selectedExpense.driver_name}</p>
                  </div>
                </div>
              )}
              {/* Reference Number */}
              {selectedExpense.reference_number && (
                <div className="flex items-start gap-2">
                  <Hash size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Reference No.</p>
                    <p className="text-gray-900 font-mono mt-0.5">{selectedExpense.reference_number}</p>
                  </div>
                </div>
              )}
              {/* Submitted at */}
              {selectedExpense.created_at && (
                <div className="flex items-start gap-2">
                  <Clock size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Submitted At</p>
                    <p className="text-gray-900 mt-0.5">
                      {fmtTs(selectedExpense.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
              {/* Paid at */}
              {selectedExpense.paid_at && (
                <div className="flex items-start gap-2">
                  <BadgeCheck size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Paid At</p>
                    <p className="text-green-700 font-medium mt-0.5">
                      {fmtTs(selectedExpense.paid_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
              {/* Verified */}
              <div className="flex items-start gap-2">
                <BadgeCheck size={14} className={`mt-0.5 shrink-0 ${selectedExpense.is_verified ? 'text-green-500' : 'text-gray-300'}`} />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Verified</p>
                  <p className={`mt-0.5 font-medium ${selectedExpense.is_verified ? 'text-green-700' : 'text-gray-400'}`}>
                    {selectedExpense.is_verified ? 'Yes — verified' : 'Not yet verified'}
                  </p>
                </div>
              </div>
              {/* Entry Source */}
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Entry Source</p>
                  <p className="text-gray-600 capitalize mt-0.5">{selectedExpense.entry_source || '—'}</p>
                </div>
              </div>
            </div>
            {/* Description */}
            {selectedExpense.description && (
              <div className="mt-4 flex items-start gap-2">
                <FileText size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-gray-700 mt-0.5">{selectedExpense.description}</p>
                </div>
              </div>
            )}
            {/* Receipt image */}
            {selectedExpense.receipt_url && (() => {
              const rUrl = fileUrl(selectedExpense.receipt_url);
              const rIsImage = rUrl && /\.(jpe?g|png|gif|webp|heic)$/i.test(rUrl);
              return (
                <div className="mt-4 rounded-xl overflow-hidden border border-gray-200">
                  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</span>
                    {rUrl && (
                      <button
                        onClick={() => setViewDoc({ url: rUrl, title: `${String(selectedExpense.category || '').replace('_', ' ')} Receipt` })}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> Full view
                      </button>
                    )}
                  </div>
                  {rIsImage && rUrl ? (
                    <img
                      src={rUrl}
                      alt="Receipt"
                      className="w-full max-h-52 object-contain bg-white cursor-pointer"
                      onClick={() => setViewDoc({ url: rUrl, title: `${String(selectedExpense.category || '').replace('_', ' ')} Receipt` })}
                    />
                  ) : rUrl ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white">
                      <Paperclip size={18} className="text-gray-400" />
                      <button type="button" onClick={() => openDocumentUrl(rUrl)} className="text-sm text-blue-600 hover:underline">View Document</button>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Fuel Entries */}
      {(fuelEntries as any[]).length > 0 && (
        <div className="card p-0">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Fuel size={18} /> Fuel Entries</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {(fuelEntries as any[]).map((fe: any) => {
              const url = fileUrl(fe.bill_url);
              const isImage = url && /\.(jpe?g|png|gif|webp|heic)$/i.test(url);
              return (
                <div key={fe.id} className="px-6 py-4 flex gap-4">
                  <div className="flex-shrink-0">
                    {url ? (
                      isImage ? (
                        <button onClick={() => setViewDoc({ url, title: `Fuel Bill${fe.bill_number ? ' #' + fe.bill_number : ''}` })}>
                          <img src={url} alt="fuel bill" className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 cursor-zoom-in" />
                        </button>
                      ) : (
                        <button onClick={() => setViewDoc({ url, title: `Fuel Bill${fe.bill_number ? ' #' + fe.bill_number : ''}` })} className="flex items-center justify-center w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100">
                          <Paperclip size={20} className="text-gray-400" />
                        </button>
                      )
                    ) : (
                      <div className="flex items-center justify-center w-16 h-16 rounded-lg border border-dashed border-gray-200 bg-gray-50">
                        <Image size={20} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{fe.pump_name || 'Fuel Fill'}</span>
                        {fe.bill_number && <span className="ml-2 text-xs text-gray-400">#{fe.bill_number}</span>}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap flex items-center gap-0.5"><IndianRupee size={12} />{Number(fe.total_amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fe.quantity_litres} L × ₹{fe.rate_per_litre}/L · {fe.fuel_type || 'diesel'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {fe.fuel_date && <span>{fmtTs(fe.fuel_date, { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                      {fe.pump_location && <span>📍 {fe.pump_location}</span>}
                      {fe.odometer_reading && <span>Odo: {fe.odometer_reading} km</span>}
                      <span className="text-blue-500">📱 Driver App</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {fe.is_verified
                      ? <span className="badge-success text-xs">Verified</span>
                      : <span className="badge-warning text-xs">Pending</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoices */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Receipt size={18} /> Invoices</h3>
          {tripInvoices.length === 0 && trip.status === 'completed' && (
            <button
              onClick={() => financeService.generateInvoiceFromTrip(Number(id)).then(() => { toast.success('Invoice generated'); })}
              className="btn-primary text-sm"
            >
              Generate Invoice
            </button>
          )}
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="table-header">Invoice No.</th>
              <th className="table-header">Date</th>
              <th className="table-header">Client</th>
              <th className="table-header">Amount (₹)</th>
              <th className="table-header">Tax (₹)</th>
              <th className="table-header">Total (₹)</th>
              <th className="table-header">Status</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(tripInvoices as any[]).length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">No invoices for this trip</td></tr>
            ) : (
              (tripInvoices as any[]).map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-primary-600">{inv.invoice_number}</td>
                  <td className="table-cell">{inv.invoice_date ? fmtTs(inv.invoice_date, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td className="table-cell">{inv.billing_name || inv.client_name || '—'}</td>
                  <td className="table-cell"><span className="flex items-center gap-1"><IndianRupee size={12} />{Number(inv.taxable_amount || inv.subtotal || 0).toLocaleString('en-IN')}</span></td>
                  <td className="table-cell"><span className="flex items-center gap-1"><IndianRupee size={12} />{Number(inv.total_tax || 0).toLocaleString('en-IN')}</span></td>
                  <td className="table-cell font-medium"><span className="flex items-center gap-1"><IndianRupee size={12} />{Number(inv.total_amount || 0).toLocaleString('en-IN')}</span></td>
                  <td className="table-cell"><StatusBadge status={inv.status || 'draft'} /></td>
                  <td className="table-cell">
                    <Link to={`/finance/invoices/${inv.id}`} className="text-primary-600 hover:underline flex items-center gap-1 text-xs"><ExternalLink size={12} /> View</Link>
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
