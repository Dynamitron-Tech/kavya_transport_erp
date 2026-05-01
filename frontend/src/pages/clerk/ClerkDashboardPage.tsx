// Clerk Dashboard — Attendance + LR summary
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, FileText, Plus, Clock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';

interface AttendanceRow {
  id: number;
  date?: string;
  status?: string;
  check_in_time?: string;
}

interface LRRow {
  id: number;
  lr_number?: string;
  consignor_name?: string;
  consignee_name?: string;
  status?: string;
  lr_date?: string;
}

const todayStr = new Date().toISOString().slice(0, 10);

export default function ClerkDashboardPage() {
  // ── attendance state ──
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [remarks, setRemarks] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const { data: attendanceData } = useQuery({
    queryKey: ['clerk-attendance'],
    queryFn: () => api.get('/attendance', { params: { page: 1, limit: 5 } }),
  });

  const { data: lrData } = useQuery({
    queryKey: ['clerk-my-lrs'],
    queryFn: () => api.get('/lr', { params: { page: 1, limit: 5, my_lrs: true } }),
  });

  const { data: allLrData } = useQuery({
    queryKey: ['clerk-all-lrs-count'],
    queryFn: () => api.get('/lr', { params: { page: 1, limit: 1 } }),
  });

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-in', { photo_data_url: photoDataUrl, remarks }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Attendance marked');
      setPhotoDataUrl('');
      setRemarks('');
      setIsCameraOpen(false);
      qc.invalidateQueries({ queryKey: ['clerk-attendance'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to mark attendance');
    },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);
    } catch {
      toast.error('Unable to access camera. Please allow camera permission.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  };

  const attendanceRows = safeArray<AttendanceRow>(
    (attendanceData as any)?.data?.items ?? (attendanceData as any)?.items ?? attendanceData,
  );
  const todayRecord = attendanceRows.find((r) => r.date?.slice(0, 10) === todayStr);
  const alreadyMarked = Boolean(todayRecord);

  const myLrRows = safeArray<LRRow>(
    (lrData as any)?.data ?? (lrData as any)?.items ?? lrData,
  );
  const allLrTotal: number =
    (allLrData as any)?.pagination?.total ?? (allLrData as any)?.total ?? 0;
  const myLrTotal: number =
    (lrData as any)?.pagination?.total ?? (lrData as any)?.total ?? myLrRows.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clerk Dashboard</h1>
          <p className="page-subtitle">Mark attendance and manage lorry receipts</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Attendance status */}
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className={`p-2.5 rounded-lg ${alreadyMarked ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            <Clock size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Today's Attendance</p>
            {alreadyMarked ? (
              <p className="text-lg font-bold text-green-700 capitalize">{todayRecord?.status}</p>
            ) : (
              <p className="text-lg font-bold text-amber-700">Not Marked</p>
            )}
            {todayRecord?.check_in_time && (
              <p className="text-xs text-gray-400 mt-0.5">
                Check-in: {new Date(todayRecord.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        {/* My LR count */}
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700">
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">My LRs</p>
            <p className="text-2xl font-bold text-gray-900">{myLrTotal}</p>
            <p className="text-xs text-gray-400 mt-0.5">Created by you</p>
          </div>
        </div>

        {/* All LR count */}
        <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">All LRs</p>
            <p className="text-2xl font-bold text-gray-900">{allLrTotal}</p>
            <p className="text-xs text-gray-400 mt-0.5">Company-wide</p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance card */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Attendance Check-In</h2>
            <Link to="/my-work/attendance" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View history <ArrowRight size={12} />
            </Link>
          </div>

          {alreadyMarked ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 size={20} className="text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Attendance marked for today</p>
                <p className="text-xs text-green-600 capitalize">Status: {todayRecord?.status}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">Camera check-in required. Marked late after 08:30 AM.</p>
              <button
                type="button"
                className="btn-primary flex items-center gap-2"
                onClick={startCamera}
                disabled={checkInMutation.isPending}
              >
                <Camera size={16} /> Open Camera
              </button>
            </>
          )}

          {isCameraOpen && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                className="w-full max-w-sm rounded-lg border border-gray-200"
                autoPlay
                muted
                playsInline
              />
              <button type="button" className="btn-primary" onClick={capturePhoto}>
                Capture Photo
              </button>
            </div>
          )}

          {photoDataUrl && !alreadyMarked && (
            <div className="space-y-3">
              <img
                src={photoDataUrl}
                alt="Captured"
                className="w-36 h-36 rounded-lg object-cover border border-gray-200"
              />
              <textarea
                className="input-field w-full"
                rows={2}
                placeholder="Remarks (optional)"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={checkInMutation.isPending}
                onClick={() => checkInMutation.mutate()}
              >
                {checkInMutation.isPending ? 'Submitting…' : 'Submit Attendance'}
              </button>
            </div>
          )}
        </div>

        {/* Recent LRs card */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">My Recent LRs</h2>
            <div className="flex items-center gap-3">
              <Link to="/lr?my_lrs=true" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
              <Link to="/lr/new" className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3">
                <Plus size={13} /> New LR
              </Link>
            </div>
          </div>

          {myLrRows.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No LRs created yet.</p>
              <Link to="/lr/new" className="text-xs text-primary-600 hover:underline mt-1 inline-block">
                Create your first LR →
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {myLrRows.slice(0, 5).map((lr) => (
                <div key={lr.id} className="py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium text-primary-600 truncate">
                      {lr.lr_number ?? `#${lr.id}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {lr.consignor_name} → {lr.consignee_name}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-3 shrink-0
                    ${lr.status === 'delivered' ? 'bg-green-100 text-green-700'
                    : lr.status === 'cancelled' ? 'bg-red-100 text-red-700'
                    : lr.status === 'in_transit' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'}`}>
                    {lr.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
