/**
 * MockDataBanner — shows a warning banner when data is from mock APIs.
 * Usage: <MockDataBanner source={data?.source} apiKey="VAHAN_API_KEY" />
 */
interface Props {
  source?: string;
  apiKey?: string;
  message?: string;
}

export default function MockDataBanner({ source, apiKey, message }: Props) {
  if (source !== 'MOCK_DATA') return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
      <span>⚠️</span>
      <span>{message || `Showing mock data${apiKey ? ` — configure ${apiKey} in .env for live results` : ''}`}</span>
    </div>
  );
}
