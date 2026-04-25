/**
 * ReadingDrawer — Tyre reading form inside a BottomSheet.
 * Used by drivers to log PSI, tread depth, condition, photo, notes.
 */
import React, { useState, useRef } from 'react';
import { Camera, CheckCircle, MinusCircle, AlertTriangle, XCircle, Upload } from 'lucide-react';
import BottomSheet from './BottomSheet';
import TyrePressureGauge from './TyrePressureGauge';
import TreadDepthBar from './TreadDepthBar';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  position: string;
  vehicleId: number;
  vehicleReg: string;
  lastPsi?: number;
  lastTread?: number;
  criticalPsi?: number;
  minPsi?: number;
  onSaved: (reading: ReadingResult) => void;
}

export interface ReadingResult {
  position: string;
  psi: number;
  tread_depth_mm: number | null;
  condition: string;
  temperature_c: number | null;
  notes: string;
  photo_url: string | null;
}

const CONDITIONS = [
  { key: 'GOOD',    label: 'Good',    Icon: CheckCircle,    color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  { key: 'AVERAGE', label: 'Average', Icon: MinusCircle,    color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  { key: 'WORN',    label: 'Worn',    Icon: AlertTriangle,  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { key: 'DAMAGED', label: 'Damaged', Icon: XCircle,        color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
];

export default function ReadingDrawer({
  isOpen, onClose, position, vehicleId, vehicleReg,
  lastPsi, lastTread, criticalPsi = 60, minPsi = 80,
  onSaved,
}: Props) {
  const [psi, setPsi] = useState<string>(lastPsi ? String(lastPsi) : '');
  const [tread, setTread] = useState<string>(lastTread ? String(lastTread) : '');
  const [condition, setCondition] = useState<string>('GOOD');
  const [temp, setTemp] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isValid = psi.trim() !== '' && !isNaN(Number(psi));
  const psiNum = Number(psi) || 0;
  const treadNum = tread ? Number(tread) : null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoUrl((res as any)?.data?.url || (res as any)?.url || null);
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await api.post('/tyre/readings', {
        vehicle_id: vehicleId,
        position,
        psi: psiNum,
        tread_depth_mm: treadNum,
        condition,
        temperature_c: temp ? Number(temp) : null,
        notes: notes || null,
        photo_url: photoUrl,
      });
      onSaved({ position, psi: psiNum, tread_depth_mm: treadNum, condition, temperature_c: temp ? Number(temp) : null, notes, photo_url: photoUrl });
      toast.success(`Reading saved for ${position}`);
      onClose();
      // Reset
      setPsi(''); setTread(''); setCondition('GOOD'); setTemp(''); setNotes(''); setPhotoUrl(null); setPhotoPreview(null);
    } catch {
      toast.error('Failed to save reading');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Tyre ${position} — ${vehicleReg}`} maxHeightVh={92}>
      <div className="space-y-5 pb-4">

        {/* PSI input + gauge */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PSI Reading *</label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              inputMode="numeric"
              value={psi}
              onChange={e => setPsi(e.target.value)}
              placeholder="e.g. 95"
              className="w-28 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex-1 flex justify-center">
              <TyrePressureGauge value={psiNum} criticalPsi={criticalPsi} minPsi={minPsi} size={140} />
            </div>
          </div>
        </div>

        {/* Tread depth */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tread Depth (mm)</label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={tread}
              onChange={e => setTread(e.target.value)}
              placeholder="e.g. 6.5"
              className="w-28 text-xl font-bold text-center border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
            />
            {treadNum !== null && treadNum > 0 && (
              <TreadDepthBar value={treadNum} />
            )}
          </div>
        </div>

        {/* Condition buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Condition *</label>
          <div className="grid grid-cols-4 gap-2">
            {CONDITIONS.map(({ key, label, Icon, color, bg }) => (
              <button
                key={key}
                onClick={() => setCondition(key)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${
                  condition === key ? bg + ' border-opacity-100' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${condition === key ? color : 'text-gray-400'}`} />
                <span className={`text-xs font-medium ${condition === key ? color : 'text-gray-500'}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Temperature (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temperature °C (optional)</label>
          <input
            type="number"
            inputMode="numeric"
            value={temp}
            onChange={e => setTemp(e.target.value)}
            placeholder="e.g. 45"
            className="w-28 border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any observations..."
            className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Photo capture */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Photo (optional)</label>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
          {photoPreview ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
              <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
              <button
                onClick={() => { setPhotoPreview(null); setPhotoUrl(null); }}
                className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
              >
                <XCircle className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition"
            >
              {uploading ? <Upload className="w-4 h-4 animate-bounce" /> : <Camera className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Take / Choose Photo'}
            </button>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className={`w-full py-3.5 rounded-xl text-white text-base font-bold transition ${
            isValid && !saving
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : 'Save Reading'}
        </button>
      </div>
    </BottomSheet>
  );
}
