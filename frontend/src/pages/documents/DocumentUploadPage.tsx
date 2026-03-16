import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/services/api';

export default function DocumentUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState('vehicle');
  const [entityId, setEntityId] = useState('');
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('other');
  const [result, setResult] = useState<any>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId || '0');
      formData.append('title', title || file.name);
      formData.append('document_type', docType);
      const resp = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(resp);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
        <p className="text-gray-500 text-sm mt-1">Upload RC, Insurance, POD, Invoice or other documents</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              <option value="vehicle">Vehicle</option>
              <option value="driver">Driver</option>
              <option value="trip">Trip</option>
              <option value="client">Client</option>
              <option value="finance">Finance</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              <option value="rc">RC</option>
              <option value="insurance">Insurance</option>
              <option value="fitness">Fitness</option>
              <option value="license">License</option>
              <option value="pollution">PUC/Pollution</option>
              <option value="invoice">Invoice</option>
              <option value="eway_bill">E-way Bill</option>
              <option value="lr_copy">LR Copy</option>
              <option value="permit">Permit</option>
              <option value="pod">POD</option>
              <option value="contract">Contract</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
          <input type="number" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="e.g., vehicle or driver ID" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>

        <button type="submit" disabled={uploadMutation.isPending || !file} className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
        </button>
      </form>

      {uploadMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">Upload failed. Please try again.</div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 font-medium">✅ Document uploaded successfully</p>
          <p className="text-sm text-gray-600 mt-1">Document ID: {result.id}</p>
          <p className="text-xs text-gray-400">URL: {result.url}</p>
        </div>
      )}
    </div>
  );
}
