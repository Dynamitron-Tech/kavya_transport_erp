import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { paymentGatewayService } from '@/services/dataService';

export default function PaymentLinkPage() {
  const [form, setForm] = useState({
    amount: '',
    description: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    reference_id: '',
  });
  const [result, setResult] = useState<any>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const data = await paymentGatewayService.createLink({
        amount: Number(form.amount),
        description: form.description,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        reference_id: form.reference_id,
      });
      setResult(data);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Payment Link</h1>
        <p className="text-gray-500 text-sm mt-1">Generate a payment link for clients</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input type="number" value={form.amount} onChange={(e) => handleChange('amount', e.target.value)} required min="1" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input type="text" value={form.description} onChange={(e) => handleChange('description', e.target.value)} required placeholder="e.g., Freight payment for Trip TRP-001" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <input type="text" value={form.customer_name} onChange={(e) => handleChange('customer_name', e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone *</label>
            <input type="tel" value={form.customer_phone} onChange={(e) => handleChange('customer_phone', e.target.value)} required placeholder="9876543210" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
            <input type="email" value={form.customer_email} onChange={(e) => handleChange('customer_email', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference ID</label>
            <input type="text" value={form.reference_id} onChange={(e) => handleChange('reference_id', e.target.value)} placeholder="e.g., INV-001" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={createMutation.isPending} className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? 'Creating...' : 'Create Payment Link'}
          </button>
        </form>

        {result && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold mb-4 text-green-700">✅ Payment Link Created</h3>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500">Link ID:</span><p className="font-mono">{result.link_id}</p></div>
              <div><span className="text-gray-500">Amount:</span><p className="font-medium">₹{result.amount?.toLocaleString()}</p></div>
              <div><span className="text-gray-500">Status:</span><p className="font-medium capitalize">{result.status}</p></div>
              <div>
                <span className="text-gray-500">Payment URL:</span>
                <p className="font-mono text-blue-600 break-all">{result.short_url}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
