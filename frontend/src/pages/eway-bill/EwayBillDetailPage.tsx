// ============================================================
// E-Way Bill Detail Page — Read-only view with status info
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ewayBillService } from '@/services/dataService';
import {
  ChevronRight, ArrowLeft, FileText, Truck, MapPin, Package,
  Printer, Download, CheckCircle2, XCircle, Clock,
  Building2, Shield, User, Phone, Hash, Calendar, Route,
  Navigation, Timer, RefreshCcw, Edit, AlertCircle,
  Copy
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:      { label: 'Draft',      color: 'text-gray-700',    bg: 'bg-gray-100 border-gray-300',      icon: <FileText size={14} />    },
  generated:  { label: 'Generated',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300',  icon: <CheckCircle2 size={14} />},
  active:     { label: 'Active',     color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300',       icon: <Navigation size={14} />  },
  in_transit: { label: 'In Transit', color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-300',   icon: <Truck size={14} />       },
  extended:   { label: 'Extended',   color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300',     icon: <RefreshCcw size={14} />  },
  completed:  { label: 'Completed',  color: 'text-green-700',   bg: 'bg-green-50 border-green-300',     icon: <CheckCircle2 size={14} />},
  cancelled:  { label: 'Cancelled',  color: 'text-red-700',     bg: 'bg-red-50 border-red-300',         icon: <XCircle size={14} />     },
  expired:    { label: 'Expired',    color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-300',   icon: <Timer size={14} />       },
};

const normalizeStatus = (status: unknown): string => String(status || '').toLowerCase();

function InfoRow({ label, value, icon, mono }: { label: string; value: React.ReactNode; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">{icon}{label}</span>
      <span className={`mt-0.5 text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-gray-100">
      <div className="p-1.5 rounded-lg bg-primary-50 text-primary-600">{icon}</div>
      <h3 className="font-semibold text-[15px] text-gray-900">{title}</h3>
    </div>
  );
}

const fmt = (v: number | undefined | null) => (v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Live countdown banner for active/in-transit e-way bills */
function EwbLiveCountdown({ validUntil, status }: { validUntil: string | null | undefined; status: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const statusKey = normalizeStatus(status);
  if (!validUntil || !['active', 'in_transit', 'extended'].includes(statusKey)) return null;

  const end = new Date(validUntil).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg"><Timer size={20} className="text-red-600" /></div>
        <div>
          <p className="font-semibold text-red-800">E-Way Bill Expired</p>
          <p className="text-sm text-red-600">This e-way bill has expired. Extend or generate a new one.</p>
        </div>
      </div>
    );
  }

  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  let bgClass = 'bg-green-50 border-green-200';
  let textClass = 'text-green-800';
  let subClass = 'text-green-600';
  if (hours < 6) { bgClass = 'bg-red-50 border-red-200'; textClass = 'text-red-800'; subClass = 'text-red-600'; }
  else if (hours < 24) { bgClass = 'bg-amber-50 border-amber-200'; textClass = 'text-amber-800'; subClass = 'text-amber-600'; }

  return (
    <div className={`${bgClass} border rounded-xl p-4 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/60 rounded-lg"><Clock size={20} className={subClass} /></div>
        <div>
          <p className={`font-semibold ${textClass}`}>Validity Countdown</p>
          <p className={`text-sm ${subClass}`}>E-Way bill {hours < 6 ? 'expiring soon' : 'is valid'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-center px-3">
          <span className={`text-2xl font-bold font-mono ${textClass}`}>{String(hours).padStart(2, '0')}</span>
          <p className="text-[10px] text-gray-500 uppercase">Hours</p>
        </div>
        <span className={`text-xl font-bold ${textClass}`}>:</span>
        <div className="text-center px-3">
          <span className={`text-2xl font-bold font-mono ${textClass}`}>{String(mins).padStart(2, '0')}</span>
          <p className="text-[10px] text-gray-500 uppercase">Min</p>
        </div>
        <span className={`text-xl font-bold ${textClass}`}>:</span>
        <div className="text-center px-3">
          <span className={`text-2xl font-bold font-mono ${textClass}`}>{String(secs).padStart(2, '0')}</span>
          <p className="text-[10px] text-gray-500 uppercase">Sec</p>
        </div>
      </div>
    </div>
  );
}

export default function EwayBillDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: eway, isLoading, isError } = useQuery({
    queryKey: ['eway-bill', id],
    queryFn: () => ewayBillService.get(parseInt(id!)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (isError || !eway) {
    return (
      <div className="text-center py-32">
        <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
        <h2 className="text-lg font-bold text-gray-900">E-Way Bill Not Found</h2>
        <p className="text-sm text-gray-500 mt-1">The requested E-Way Bill could not be loaded.</p>
        <button onClick={() => navigate('/lr/eway-bill')} className="btn-primary mt-4 text-sm">Back to List</button>
      </div>
    );
  }

  const statusKey = normalizeStatus(eway.status);
  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
  const isInterstate = eway.supplier_state_code !== eway.recipient_state_code;

  return (
    <div className="max-w-[1100px] mx-auto pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
        <Link to="/dashboard" className="hover:text-primary-600">Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <Link to="/lr/eway-bill" className="hover:text-primary-600">E-Way Bills</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-900 font-semibold">{eway.eway_bill_number || `#${eway.id}`}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {eway.eway_bill_number || `E-Way Bill #${eway.id}`}
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold border rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
              {isInterstate && <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">IGST</span>}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Created on {eway.created_at ? new Date(eway.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {eway.status === 'draft' && (
            <button onClick={() => navigate(`/lr/eway-bill/${eway.id}/edit`)} className="btn-primary flex items-center gap-1.5 text-sm"><Edit size={15} /> Edit</button>
          )}
          <button onClick={() => {
            ewayBillService.print(eway.id).then((data: any) => {
              const win = window.open('', '_blank');
              if (win) win.document.write(`<pre style="font-family:monospace;font-size:12px">${JSON.stringify(data, null, 2)}</pre>`);
            });
          }} className="btn-ghost flex items-center gap-1.5 text-sm"><Printer size={15} /> Print</button>
          <button className="btn-ghost flex items-center gap-1.5 text-sm"><Download size={15} /> Download</button>
          <button onClick={() => navigator.clipboard.writeText(eway.eway_bill_number || '')} className="btn-ghost flex items-center gap-1.5 text-sm"><Copy size={15} /> Copy No.</button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Live Validity Countdown */}
        <EwbLiveCountdown validUntil={eway.valid_until || eway.extended_until} status={statusKey} />

        {/* Reference Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <SectionHeader title="Reference Details" icon={<FileText size={18} />} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoRow label="E-Way Bill No." value={eway.eway_bill_number} icon={<Hash size={11} />} mono />
            <InfoRow label="E-Way Bill Date" value={eway.eway_bill_date} icon={<Calendar size={11} />} />
            <InfoRow label="Job" value={eway.job_number || `#${eway.job_id}`} />
            <InfoRow label="LR" value={eway.lr_number || (eway.lr_id ? `#${eway.lr_id}` : '—')} />
            <InfoRow label="Transaction Type" value={eway.transaction_type} />
            <InfoRow label="Sub Type" value={eway.transaction_sub_type} />
            <InfoRow label="Document Type" value={eway.document_type} />
            <InfoRow label="Document No." value={eway.document_number} />
          </div>
        </div>

        {/* Supplier + Recipient side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <SectionHeader title="Supplier (From)" icon={<Building2 size={18} />} />
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Name" value={eway.supplier_name} icon={<User size={11} />} />
              <InfoRow label="GSTIN" value={eway.supplier_gstin} icon={<Shield size={11} />} mono />
              <InfoRow label="State" value={`${eway.supplier_state || ''} (${eway.supplier_state_code || ''})`} />
              <InfoRow label="City" value={eway.supplier_city} />
              <InfoRow label="Phone" value={eway.supplier_phone} icon={<Phone size={11} />} />
              <InfoRow label="Pincode" value={eway.supplier_pincode} icon={<MapPin size={11} />} />
              <div className="col-span-2"><InfoRow label="Address" value={eway.supplier_address} /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <SectionHeader title="Recipient (To)" icon={<MapPin size={18} />} />
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Name" value={eway.recipient_name} icon={<User size={11} />} />
              <InfoRow label="GSTIN" value={eway.recipient_gstin} icon={<Shield size={11} />} mono />
              <InfoRow label="State" value={`${eway.recipient_state || ''} (${eway.recipient_state_code || ''})`} />
              <InfoRow label="City" value={eway.recipient_city} />
              <InfoRow label="Phone" value={eway.recipient_phone} icon={<Phone size={11} />} />
              <InfoRow label="Pincode" value={eway.recipient_pincode} icon={<MapPin size={11} />} />
              <div className="col-span-2"><InfoRow label="Address" value={eway.recipient_address} /></div>
            </div>
          </div>
        </div>

        {/* Goods Items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <SectionHeader title={`Goods Details — ${eway.items?.length || 0} Item(s)`} icon={<Package size={18} />} />
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">HSN</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Taxable (₹)</th>
                  {isInterstate ? (
                    <th className="px-4 py-2 text-right">IGST (₹)</th>
                  ) : (
                    <>
                      <th className="px-4 py-2 text-right">CGST (₹)</th>
                      <th className="px-4 py-2 text-right">SGST (₹)</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(eway.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{item.product_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{item.hsn_code}</td>
                    <td className="px-4 py-2.5 text-right">{item.quantity} {item.quantity_unit}</td>
                    <td className="px-4 py-2.5 text-right">₹{fmt(item.taxable_value)}</td>
                    {isInterstate ? (
                      <td className="px-4 py-2.5 text-right">₹{fmt(item.igst_amount)} <span className="text-xs text-gray-400">({item.igst_rate}%)</span></td>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-right">₹{fmt(item.cgst_amount)} <span className="text-xs text-gray-400">({item.cgst_rate}%)</span></td>
                        <td className="px-4 py-2.5 text-right">₹{fmt(item.sgst_amount)} <span className="text-xs text-gray-400">({item.sgst_rate}%)</span></td>
                      </>
                    )}
                    <td className="px-4 py-2.5 text-right font-semibold">₹{fmt(item.total_item_value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary-50/50 font-semibold text-gray-900">
                  <td colSpan={4} className="px-4 py-2.5 text-right">Totals</td>
                  <td className="px-4 py-2.5 text-right">₹{fmt(eway.total_taxable_value)}</td>
                  {isInterstate ? (
                    <td className="px-4 py-2.5 text-right">₹{fmt(eway.igst_amount)}</td>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 text-right">₹{fmt(eway.cgst_amount)}</td>
                      <td className="px-4 py-2.5 text-right">₹{fmt(eway.sgst_amount)}</td>
                    </>
                  )}
                  <td className="px-4 py-2.5 text-right text-primary-700">₹{fmt(eway.total_invoice_value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Transport + Validity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <SectionHeader title="Transport Details" icon={<Truck size={18} />} />
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Mode" value={eway.transport_mode} />
              <InfoRow label="Vehicle No." value={eway.vehicle_number} mono />
              <InfoRow label="Vehicle Category" value={eway.vehicle_type} />
              <InfoRow label="Distance" value={`${eway.distance_km || 0} km`} icon={<Route size={11} />} />
              <InfoRow label="Transporter" value={eway.transporter_name} icon={<Building2 size={11} />} />
              <InfoRow label="Transporter GSTIN" value={eway.transporter_gstin} icon={<Shield size={11} />} mono />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <SectionHeader title="Validity & Compliance" icon={<Clock size={18} />} />
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Validity (days)" value={eway.validity_days || '—'} />
              <InfoRow label="Valid From" value={eway.valid_from ? new Date((eway.valid_from) ?? 0).toLocaleString('en-IN') : '—'} />
              <InfoRow label="Valid Until" value={eway.valid_until ? new Date((eway.valid_until) ?? 0).toLocaleString('en-IN') : '—'} />
              <InfoRow label="Generated At" value={eway.generated_at ? new Date((eway.generated_at) ?? 0).toLocaleString('en-IN') : '—'} />
              {statusKey === 'cancelled' && (
                <>
                  <InfoRow label="Cancel Reason" value={eway.cancelled_reason} />
                  <InfoRow label="Cancelled At" value={eway.cancelled_at ? new Date((eway.cancelled_at) ?? 0).toLocaleString('en-IN') : '—'} />
                </>
              )}
              {statusKey === 'extended' && (
                <>
                  <InfoRow label="Extended Reason" value={eway.extension_reason} />
                  <InfoRow label="Extended Until" value={eway.extended_until ? new Date((eway.extended_until) ?? 0).toLocaleString('en-IN') : '—'} />
                </>
              )}
            </div>
            {eway.remarks && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-0.5">Remarks</p>
                <p className="text-sm text-gray-700">{eway.remarks}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
