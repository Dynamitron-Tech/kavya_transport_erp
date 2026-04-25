import apiClient from '../services/api';

export interface CheckResult {
  endpoint: string;
  status: 'ok' | 'fail' | 'error';
  statusCode?: number;
  error?: string;
}

export const checkAllConnections = async (): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];

  const endpoints = [
    '/clients',
    '/vehicles',
    '/drivers',
    '/routes',
    '/jobs',
    '/lr',
    '/ewb',
    '/trips',
    '/tracking/live',
    '/expenses',
    '/fuel',
    '/attendance',
    '/checklists',
    '/invoices',
    '/banking',
    '/ledger',
    '/tyre',
    '/service',
    '/notifications',
    '/notifications/unread-count',
    '/reports/dashboard',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await apiClient.get(endpoint);
      const statusCode = (response as any)?.status ?? 200;
      results.push({ endpoint, status: 'ok', statusCode });
    } catch (error: any) {
      results.push({
        endpoint,
        status: error?.response ? 'fail' : 'error',
        statusCode: error?.response?.status,
        error: error?.message ?? 'Unknown error',
      });
    }
  }

  return results;
};
