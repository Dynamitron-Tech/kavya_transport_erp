/**
 * DataSourceTag — small tag showing whether data is MOCK or LIVE.
 * Usage: <DataSourceTag source={data?.source} />
 */
interface Props {
  source?: string;
}

export default function DataSourceTag({ source }: Props) {
  if (!source) return null;
  const isMock = source === 'MOCK_DATA';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${isMock ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
      {isMock ? '⚡ Mock' : '✓ Live'}
    </span>
  );
}
