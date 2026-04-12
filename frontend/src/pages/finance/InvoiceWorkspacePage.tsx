import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileSpreadsheet, AlertCircle, CheckCircle2, Clock, IndianRupee, Keyboard } from 'lucide-react';
import { invoiceWorkspaceService, ProcessingBatch, IfiasLineItem } from '@/services/invoiceWorkspaceService';
import BatchSelector from '@/components/InvoiceWorkspace/BatchSelector';
import LineItemTable from '@/components/InvoiceWorkspace/LineItemTable';
import BulkActionBar from '@/components/InvoiceWorkspace/BulkActionBar';
import PDFPreviewPanel from '@/components/InvoiceWorkspace/PDFPreviewPanel';

type TabFilter = 'ALL' | 'AUTO_APPROVED' | 'NEEDS_REVIEW' | 'REJECTED' | 'CONFIRMED';

const TABS: { key: TabFilter; label: string; icon: string }[] = [
  { key: 'ALL', label: 'All', icon: '' },
  { key: 'AUTO_APPROVED', label: 'Auto-approved', icon: '✅' },
  { key: 'NEEDS_REVIEW', label: 'Review', icon: '⚠️' },
  { key: 'REJECTED', label: 'Rejected', icon: '❌' },
  { key: 'CONFIRMED', label: 'Confirmed', icon: '✔️' },
];

export default function InvoiceWorkspacePage() {
  const qc = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [page, setPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<IfiasLineItem | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Keyboard mode state
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [focusedItemIdx, setFocusedItemIdx] = useState<number | null>(null);
  const kbStartTimeRef = useRef<number | null>(null);
  const [confirmedInSession, setConfirmedInSession] = useState(0);

  // Batches list
  const { data: batchesRes, isLoading: batchesLoading } = useQuery({
    queryKey: ['ifias-batches'],
    queryFn: () => invoiceWorkspaceService.listBatches({ limit: 50 }),
    refetchInterval: 15_000,
  });
  const batches: ProcessingBatch[] = batchesRes?.data ?? [];

  // Selected batch detail
  const { data: batchDetail } = useQuery({
    queryKey: ['ifias-batch', selectedBatchId],
    queryFn: () => invoiceWorkspaceService.getBatch(selectedBatchId!),
    enabled: selectedBatchId !== null,
    refetchInterval: 5_000,
  });

  // Line items
  const { data: itemsRes, isLoading: itemsLoading } = useQuery({
    queryKey: ['ifias-items', selectedBatchId, activeTab, page],
    queryFn: () =>
      invoiceWorkspaceService.listLineItems(selectedBatchId!, {
        page,
        limit: 50,
        status: activeTab === 'ALL' ? undefined : activeTab,
      }),
    enabled: selectedBatchId !== null,
    refetchInterval: 10_000,
  });
  const items: IfiasLineItem[] = itemsRes?.data ?? [];
  const totalItems = itemsRes?.pagination?.total ?? 0;
  const totalPages = itemsRes?.pagination?.pages ?? 1;

  // WebSocket — real-time progress
  useEffect(() => {
    if (!selectedBatchId) return;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/batch/${selectedBatchId}/progress`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'progress' || msg.type === 'completed') {
          qc.invalidateQueries({ queryKey: ['ifias-batch', selectedBatchId] });
          qc.invalidateQueries({ queryKey: ['ifias-items', selectedBatchId] });
        }
        if (msg.type === 'completed') {
          toast.success(`Batch processing complete! ${msg.approved} auto-approved, ${msg.review} need review.`);
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [selectedBatchId, qc]);

  // Keyboard mode – Escape exits, ArrowUp/Down navigate rows without focusing a field
  useEffect(() => {
    if (!keyboardMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKeyboardMode(false);
        setFocusedItemIdx(null);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Only move row focus when no input is active
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setFocusedItemIdx(prev => {
          const next = (prev ?? -1) + (e.key === 'ArrowDown' ? 1 : -1);
          return Math.max(0, Math.min(items.length - 1, next));
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [keyboardMode, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start keyboard mode
  const startKeyboardMode = () => {
    setKeyboardMode(true);
    setFocusedItemIdx(0);
    setConfirmedInSession(0);
    kbStartTimeRef.current = Date.now();
  };

  const exitKeyboardMode = () => {
    setKeyboardMode(false);
    setFocusedItemIdx(null);
  };

  // Confirm mutation (for PDF panel)
  const confirmMutation = useMutation({
    mutationFn: (item: IfiasLineItem) =>
      invoiceWorkspaceService.updateLineItem(selectedBatchId!, item.id, { processing_status: 'CONFIRMED' }),
    onSuccess: () => {
      toast.success('Confirmed');
      qc.invalidateQueries({ queryKey: ['ifias-items', selectedBatchId] });
      qc.invalidateQueries({ queryKey: ['ifias-batch', selectedBatchId] });
      setPreviewItem(null);
    },
  });

  // Tab counts from batch
  const tabCount = (tab: TabFilter) => {
    if (!batchDetail) return null;
    switch (tab) {
      case 'ALL': return batchDetail.total_lrs;
      case 'AUTO_APPROVED': return batchDetail.approved_lrs;
      case 'NEEDS_REVIEW': return batchDetail.review_lrs;
      case 'REJECTED': return batchDetail.rejected_lrs;
      case 'CONFIRMED': return batchDetail.confirmed_lrs;
    }
  };

  // Summary stats
  const totalPayable = items.reduce((s, i) => s + (i.payable ?? 0), 0);
  const totalDetention = items.reduce((s, i) => s + (i.detention_charge ?? 0), 0);
  const shortageItems = items.filter(i => (i.shortage ?? 0) > 0).length;

  const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileSpreadsheet size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoice Workspace</h1>
              <p className="text-xs text-gray-500">IFIAS — Intelligent Freight Invoice Automation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Summary stats cards */}
            {selectedBatchId && batchDetail && (
              <div className="hidden lg:flex gap-3">
                <StatCard label="Payable" value={formatINR(totalPayable)} icon={<IndianRupee size={14} />} color="blue" />
                <StatCard label="Detention" value={formatINR(totalDetention)} icon={<Clock size={14} />} color="yellow" />
                <StatCard label="Shortages" value={`${shortageItems} rows`} icon={<AlertCircle size={14} />} color="red" />
                <StatCard label="Pending Review" value={String(batchDetail.review_lrs)} icon={<CheckCircle2 size={14} />} color="orange" />
              </div>
            )}
            {/* Keyboard mode toggle */}
            {selectedBatchId && (
              <button
                onClick={keyboardMode ? exitKeyboardMode : startKeyboardMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  keyboardMode ? 'bg-blue-600 text-white shadow' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title="Keyboard review mode (Tab + Enter)"
              >
                <Keyboard size={14} />
                {keyboardMode ? 'Exit keyboard mode' : 'Keyboard mode'}
              </button>
            )}
          </div>
        </div>

        {/* Batch Selector */}
        <BatchSelector
          batches={batches}
          selectedBatchId={selectedBatchId}
          onSelect={(id) => {
            setSelectedBatchId(id);
            setActiveTab('ALL');
            setPage(1);
          }}
          isLoading={batchesLoading}
        />

        {selectedBatchId && (
          <>
            {/* Filter Tabs */}
            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 w-fit">
              {TABS.map(tab => {
                const count = tabCount(tab.key);
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setPage(1); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab.icon} {tab.label}
                    {count !== null && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                        activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Keyboard mode progress bar + hint (Step 2C) */}
            {keyboardMode && (
              <div className="bg-blue-600 text-white rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <Keyboard size={14} />
                    <span className="font-medium">Keyboard review mode</span>
                    <span className="text-blue-200 text-xs">
                      Tab → next field &nbsp;|&nbsp; Enter → confirm row &nbsp;|&nbsp; Esc → exit
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{confirmedInSession}</span>
                    <span className="text-blue-200"> confirmed this session</span>
                    {confirmedInSession > 0 && kbStartTimeRef.current && (() => {
                      const elapsed = (Date.now() - kbStartTimeRef.current) / 1000;
                      const rate = confirmedInSession / elapsed;
                      const remaining = (batchDetail?.review_lrs ?? 0) - confirmedInSession;
                      const eta = remaining > 0 && rate > 0 ? Math.round(remaining / rate) : null;
                      return eta ? <span className="ml-2 text-blue-200 text-xs">ETA ~{eta}s</span> : null;
                    })()}
                  </div>
                </div>
                {/* Progress bar */}
                {batchDetail && batchDetail.total_lrs > 0 && (
                  <div className="h-1.5 bg-blue-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(((batchDetail.confirmed_lrs ?? 0) / batchDetail.total_lrs) * 100)}%` }}
                    />
                  </div>
                )}
                {/* Completion banner */}
                {batchDetail && batchDetail.confirmed_lrs >= batchDetail.total_lrs && batchDetail.total_lrs > 0 && (
                  <div className="text-center text-sm font-semibold text-green-200">
                    ✓ All {batchDetail.total_lrs} rows confirmed!
                  </div>
                )}
              </div>
            )}

            {/* Bulk Actions */}
            {batchDetail && (
              <BulkActionBar
                batchId={selectedBatchId}
                totalApproved={batchDetail.approved_lrs}
                totalConfirmed={batchDetail.confirmed_lrs}
              />
            )}

            {/* Line Items Table */}
            {itemsLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading items...</div>
            ) : (
              <LineItemTable
                batchId={selectedBatchId}
                items={items}
                onViewPdf={setPreviewItem}
                keyboardMode={keyboardMode}
                focusedItemIdx={focusedItemIdx}
                onRowAdvance={(nextIdx) => {
                  if (nextIdx < items.length) {
                    setFocusedItemIdx(nextIdx);
                  } else {
                    toast.success('Last row reached');
                    exitKeyboardMode();
                  }
                }}
                onRowConfirm={(item) => {
                  setConfirmedInSession(n => n + 1);
                  confirmMutation.mutate(item);
                }}
              />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{totalItems} total items</span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1 text-xs">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!selectedBatchId && !batchesLoading && (
          <div className="text-center py-24 text-gray-400">
            <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a billing batch above to begin review</p>
            {batches.length === 0 && (
              <p className="text-xs mt-2 text-gray-300">
                No batches found. The file watcher will create batches automatically when Excel files appear in OneDrive.
              </p>
            )}
          </div>
        )}
      </div>

      {/* PDF Preview Slide Panel */}
      {previewItem && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setPreviewItem(null)} />
          <PDFPreviewPanel
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onConfirm={(item) => confirmMutation.mutate(item)}
          />
        </>
      )}
    </div>
  );
}

// Small stat card component
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors[color] ?? 'bg-gray-50 text-gray-700'}`}>
      {icon}
      <div>
        <p className="text-xs opacity-70">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}
