import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, X, DollarSign, FileText, Calendar, User, TrendingUp } from 'lucide-react';
import { accountantService } from '../../services/dataService';
import toast from 'react-hot-toast';

interface Payment {
  id: number;
  payment_number: string;
  driver_name: string;
  amount: number;
  payment_type: string;
  source_ref: string;
  approved_at: string;
  completed_at?: string;
  transaction_ref?: string;
  payment_method?: string;
}

interface PaymentsData {
  pending: Payment[];
  history: Payment[];
  total_pending: number;
  total_paid: number;
}

interface PaymentFormData {
  payment_method: string;
  transaction_ref: string;
}

const AccountantDriverPaymentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    payment_method: 'upi',
    transaction_ref: '',
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<PaymentsData>({
    queryKey: ['accountant-driver-payments', activeTab],
    queryFn: () => accountantService.getDriverPayments(activeTab === 'pending' ? 'pending' : 'completed'),
  });

  const processPaymentMutation = useMutation({
    mutationFn: (payload: { paymentId: number; data: PaymentFormData }) =>
      accountantService.processDriverPayment(payload.paymentId, payload.data),
    onSuccess: () => {
      toast.success('Payment processed successfully');
      queryClient.invalidateQueries({ queryKey: ['accountant-driver-payments'] });
      setSelectedPayment(null);
      setFormData({ payment_method: 'upi', transaction_ref: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to process payment');
    },
  });

  const handlePayNow = (payment: Payment) => {
    setSelectedPayment(payment);
    setFormData({ payment_method: 'upi', transaction_ref: '' });
  };

  const handleSubmitPayment = () => {
    if (!selectedPayment) return;
    if (!formData.transaction_ref.trim()) {
      toast.error('Please enter transaction reference');
      return;
    }
    processPaymentMutation.mutate({
      paymentId: selectedPayment.id,
      data: formData,
    });
  };

  const getPaymentTypeBadge = (sourceRef: string) => {
    if (sourceRef.startsWith('trip_pay:')) {
      return <span className="badge badge-primary">Trip Payment</span>;
    }
    if (sourceRef.startsWith('expense:')) {
      return <span className="badge badge-warning">Expense Reimbursement</span>;
    }
    return <span className="badge badge-secondary">Other</span>;
  };

  const payments = activeTab === 'pending' ? data?.pending || [] : data?.history || [];

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 rounded-xl">
            <Wallet className="text-green-600" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Driver Payments</h1>
            <p className="text-gray-600 text-sm">Process trip payments and expense reimbursements</p>
          </div>
        </div>
        {data && (
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Pending Amount</p>
              <p className="text-xl font-bold text-red-600">₹{data.total_pending.toLocaleString('en-IN')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-xl font-bold text-green-600">₹{data.total_paid.toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending {data && `(${data.pending.length})`}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          History {data && `(${data.history.length})`}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading payments...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Wallet className="mx-auto text-gray-400" size={48} />
          <p className="text-gray-600 mt-4 text-lg">
            {activeTab === 'pending' ? 'No pending payments' : 'No payment history'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {payments.map((payment: Payment) => (
            <div
              key={payment.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{payment.driver_name}</h3>
                      <p className="text-sm text-gray-600">{payment.payment_number}</p>
                    </div>
                    {getPaymentTypeBadge(payment.source_ref)}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <DollarSign size={16} className="text-green-600" />
                      <span className="font-semibold text-lg">₹{payment.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={16} />
                      <span>
                        {activeTab === 'pending' ? 'Approved' : 'Paid'}{' '}
                        {new Date(activeTab === 'pending' ? payment.approved_at : payment.completed_at!).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    {payment.transaction_ref && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText size={16} />
                        <span>UTR: {payment.transaction_ref}</span>
                      </div>
                    )}
                  </div>

                  {payment.payment_method && (
                    <div className="mt-2 text-sm text-gray-600">
                      Payment Method: <span className="font-medium capitalize">{payment.payment_method}</span>
                    </div>
                  )}
                </div>

                {activeTab === 'pending' && (
                  <button
                    onClick={() => handlePayNow(payment)}
                    className="btn-success ml-4 flex items-center gap-2"
                  >
                    <TrendingUp size={16} />
                    Pay Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pay Now Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Process Payment</h2>
                <p className="text-sm text-gray-600">{selectedPayment.payment_number}</p>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Driver:</span>
                  <span className="font-semibold">{selectedPayment.driver_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Amount:</span>
                  <span className="text-xl font-bold text-green-600">
                    ₹{selectedPayment.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="input w-full"
                >
                  <option value="upi">UPI</option>
                  <option value="neft">NEFT</option>
                  <option value="rtgs">RTGS</option>
                  <option value="imps">IMPS</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Reference / UTR
                </label>
                <input
                  type="text"
                  value={formData.transaction_ref}
                  onChange={(e) => setFormData({ ...formData, transaction_ref: e.target.value })}
                  placeholder="Enter UTR or transaction ID"
                  className="input w-full"
                />
              </div>

            </div>

            <div className="flex gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setSelectedPayment(null)}
                className="btn-secondary flex-1"
                disabled={processPaymentMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                className="btn-success flex-1"
                disabled={processPaymentMutation.isPending || !formData.transaction_ref.trim()}
              >
                {processPaymentMutation.isPending ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountantDriverPaymentsPage;
