import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notificationService } from '@/services/dataService';

type Tab = 'sms' | 'whatsapp' | 'push';

export default function NotificationCenterPage() {
  const [tab, setTab] = useState<Tab>('sms');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [deviceToken, setDeviceToken] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<any>(null);

  const smsMutation = useMutation({
    mutationFn: () => notificationService.sendSMS(phone, message),
    onSuccess: (data) => setResult(data),
  });

  const whatsappMutation = useMutation({
    mutationFn: () => notificationService.sendWhatsApp(phone, message),
    onSuccess: (data) => setResult(data),
  });

  const pushMutation = useMutation({
    mutationFn: () => notificationService.sendPush({ device_token: deviceToken, title, body }),
    onSuccess: (data) => setResult(data),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (tab === 'sms') smsMutation.mutate();
    else if (tab === 'whatsapp') whatsappMutation.mutate();
    else pushMutation.mutate();
  };

  const isPending = smsMutation.isPending || whatsappMutation.isPending || pushMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
        <p className="text-gray-500 text-sm mt-1">Send SMS, WhatsApp, or Push notifications</p>
      </div>

      {result?.source === 'MOCK_DATA' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
          ⚠️ Mock notification — configure API keys in .env for real delivery
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Tabs */}
        <div className="flex border-b">
          {(['sms', 'whatsapp', 'push'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setResult(null); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'sms' ? '📱 SMS' : t === 'whatsapp' ? '💬 WhatsApp' : '🔔 Push'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4">
          {(tab === 'sms' || tab === 'whatsapp') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="9876543210" className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={3} className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {tab === 'push' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device Token</label>
                <input type="text" value={deviceToken} onChange={(e) => setDeviceToken(e.target.value)} required className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          <button type="submit" disabled={isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Sending...' : `Send ${tab.toUpperCase()}`}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 font-medium">✅ Notification sent successfully</p>
          <p className="text-sm text-gray-600 mt-1">Message ID: {result.message_id || result.request_id || '-'}</p>
          <p className="text-xs text-gray-400">Source: {result.source}</p>
        </div>
      )}
    </div>
  );
}
