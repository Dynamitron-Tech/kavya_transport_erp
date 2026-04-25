import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notificationService } from '@/services/dataService';
import { useAppStore } from '@/store/appStore';
import { Bell, CheckCheck, Trash2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

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
          <p className="text-green-700 font-medium">Notification sent successfully</p>
          <p className="text-sm text-gray-600 mt-1">Message ID: {result.message_id || result.request_id || '-'}</p>
        </div>
      )}

      {/* Notification Inbox */}
      <NotificationInbox />
    </div>
  );
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertCircle size={16} className="text-red-500" />,
  warning: <AlertTriangle size={16} className="text-amber-500" />,
  info: <Info size={16} className="text-blue-500" />,
};

function NotificationInbox() {
  const { notifications, unreadCount, markAsRead, clearNotifications } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-primary-600" />
          <h2 className="text-lg font-bold text-gray-900">Notification Inbox</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {filter === 'all' ? 'Show Unread' : 'Show All'}
          </button>
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} /> Clear All
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
            <p className="text-xs text-gray-400 mt-1">Real-time notifications will appear here when events occur.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((notif) => (
              <div
                key={notif.id}
                className={`px-6 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-primary-50/20' : ''}`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {SEVERITY_ICON[notif.severity] || SEVERITY_ICON.info}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(notif.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!notif.is_read && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-primary-50 transition-colors flex-shrink-0"
                    title="Mark as read"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
