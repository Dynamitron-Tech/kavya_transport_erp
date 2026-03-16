import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/services/api';
import { checkAllConnections, type CheckResult } from '@/utils/connectivityChecker';

interface DbHealth {
  postgresql: string;
  mongodb: string;
  redis: string;
  celery: string;
}

const badgeClass = (status: CheckResult['status']) => {
  if (status === 'ok') return 'bg-emerald-100 text-emerald-700';
  if (status === 'fail') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
};

const rowClass = (status: CheckResult['status']) => {
  if (status === 'ok') return 'bg-emerald-50/70';
  return 'bg-rose-50/70';
};

export default function ConnectivityPage() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    try {
      const [apiResults, healthResponse] = await Promise.all([
        checkAllConnections(),
        apiClient.get('/admin/health'),
      ]);

      const healthPayload = (healthResponse as any)?.data ?? healthResponse;
      setResults(apiResults);
      setDbHealth({
        postgresql: healthPayload?.postgresql ?? 'error',
        mongodb: healthPayload?.mongodb ?? 'error',
        redis: healthPayload?.redis ?? 'error',
        celery: healthPayload?.celery ?? 'stopped',
      });
    } catch {
      const apiResults = await checkAllConnections();
      setResults(apiResults);
      setDbHealth({
        postgresql: 'error',
        mongodb: 'error',
        redis: 'error',
        celery: 'stopped',
      });
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const summary = useMemo(() => {
    const ok = results.filter((r) => r.status === 'ok').length;
    const failed = results.filter((r) => r.status !== 'ok').length;
    return { ok, failed, total: results.length };
  }, [results]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connectivity Audit</h1>
          <p className="text-sm text-gray-500">API endpoints and database connectivity overview</p>
        </div>
        <button
          onClick={runChecks}
          disabled={isRunning}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {isRunning ? 'Running...' : 'Run Tests'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500">Total Endpoints</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Passed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.ok}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Failed</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{summary.failed}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Health Checked</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{dbHealth ? 'Yes' : 'No'}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Database Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">PostgreSQL</p>
            <p className="font-semibold text-gray-900 mt-1">{dbHealth?.postgresql ?? 'unknown'}</p>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">MongoDB</p>
            <p className="font-semibold text-gray-900 mt-1">{dbHealth?.mongodb ?? 'unknown'}</p>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">Redis</p>
            <p className="font-semibold text-gray-900 mt-1">{dbHealth?.redis ?? 'unknown'}</p>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">Celery</p>
            <p className="font-semibold text-gray-900 mt-1">{dbHealth?.celery ?? 'unknown'}</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Endpoint Results</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 font-semibold text-gray-700">Endpoint</th>
                <th className="px-3 py-2 font-semibold text-gray-700">Status Code</th>
                <th className="px-3 py-2 font-semibold text-gray-700">Result</th>
                <th className="px-3 py-2 font-semibold text-gray-700">Error</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.endpoint} className={`${rowClass(row.status)} border-b border-gray-100`}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{row.endpoint}</td>
                  <td className="px-3 py-2 text-gray-700">{row.statusCode ?? '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass(row.status)}`}>
                      {row.status === 'ok' ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{row.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
