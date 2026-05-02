import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ewayBillService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Floating EWB Expiry Alert — shows when EWBs are expiring within 4 hours.
 * Place in layout or dashboard header.
 */
export default function EWBExpiryAlert() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const { data: expiring } = useQuery({
    queryKey: ['ewb-expiring-alert'],
    queryFn: () => ewayBillService.getExpiring(4),
    refetchInterval: 5 * 60 * 1000,
  });

  const bills = safeArray(expiring);

  // Reset dismissed when new bills appear
  useEffect(() => {
    if (bills.length > 0) setDismissed(false);
  }, [bills.length]);

  if (dismissed || bills.length === 0) return null;

  const critical = bills.filter((b: any) => {
    if (!b.valid_until) return false;
    const hoursLeft = (new Date(b.valid_until).getTime() - Date.now()) / 3_600_000;
    return hoursLeft <= 1;
  });

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg shadow-lg border ${critical.length > 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'} p-4`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${critical.length > 0 ? 'text-red-500' : 'text-amber-500'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${critical.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
            {critical.length > 0 ? 'CRITICAL: ' : ''}{bills.length} EWB{bills.length > 1 ? 's' : ''} expiring soon!
          </p>
          <div className="mt-1 space-y-0.5">
            {bills.slice(0, 2).map((bill: any) => {
              const hoursLeft = bill.valid_until ? (new Date(bill.valid_until).getTime() - Date.now()) / 3_600_000 : 0;
              return (
                <p key={bill.id} className="text-xs text-gray-700 truncate">
                  <span className="font-mono">{bill.eway_bill_number}</span>{' · '}
                  <span className={hoursLeft <= 1 ? 'text-red-600 font-semibold' : 'text-amber-600'}>
                    <Clock className="w-3 h-3 inline" /> {hoursLeft > 0 ? `${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m` : 'Expired'}
                  </span>
                </p>
              );
            })}
          </div>
          <button onClick={() => navigate('/eway-bills')} className="text-xs text-blue-600 hover:underline mt-1.5">
            View all E-Way Bills →
          </button>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-white/50 rounded">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
