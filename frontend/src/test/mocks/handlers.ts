import { http, HttpResponse } from 'msw';
import {
  mockUser,
  mockClient,
  mockVehicle,
  mockDriver,
  mockJob,
  mockLR,
  mockTrip,
  mockInvoice,
  mockDashboardStats,
  mockPaginatedResponse,
} from './data';

const BASE = '/api/v1';

export const handlers = [
  // ---- Auth ----
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({
      success: true,
      data: {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        user: mockUser,
      },
      message: 'Login successful',
    }),
  ),

  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({
      success: true,
      data: mockUser,
      message: 'ok',
    }),
  ),

  http.post(`${BASE}/auth/register`, () =>
    HttpResponse.json({
      success: true,
      data: mockUser,
      message: 'Registration successful',
    }),
  ),

  http.post(`${BASE}/auth/logout`, () => HttpResponse.json({ success: true })),

  // ---- Clients ----
  http.get(`${BASE}/clients`, () =>
    HttpResponse.json(mockPaginatedResponse([mockClient])),
  ),

  http.get(`${BASE}/clients/:id`, () => HttpResponse.json(mockClient)),

  http.post(`${BASE}/clients`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockClient, ...body, id: 2 }, { status: 201 });
  }),

  http.put(`${BASE}/clients/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockClient, ...body });
  }),

  http.delete(`${BASE}/clients/:id`, () =>
    HttpResponse.json({ success: true }),
  ),

  // ---- Vehicles ----
  http.get(`${BASE}/vehicles`, () =>
    HttpResponse.json(mockPaginatedResponse([mockVehicle])),
  ),

  http.get(`${BASE}/vehicles/:id`, () => HttpResponse.json(mockVehicle)),

  http.post(`${BASE}/vehicles`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockVehicle, ...body, id: 2 }, { status: 201 });
  }),

  http.put(`${BASE}/vehicles/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockVehicle, ...body });
  }),

  http.delete(`${BASE}/vehicles/:id`, () =>
    HttpResponse.json({ success: true }),
  ),

  // ---- Drivers ----
  http.get(`${BASE}/drivers`, () =>
    HttpResponse.json(mockPaginatedResponse([mockDriver])),
  ),

  http.get(`${BASE}/drivers/:id`, () => HttpResponse.json(mockDriver)),

  http.post(`${BASE}/drivers`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockDriver, ...body, id: 2 }, { status: 201 });
  }),

  http.put(`${BASE}/drivers/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockDriver, ...body });
  }),

  // ---- Jobs ----
  http.get(`${BASE}/jobs`, () =>
    HttpResponse.json(mockPaginatedResponse([mockJob])),
  ),

  http.get(`${BASE}/jobs/:id`, () => HttpResponse.json(mockJob)),

  http.post(`${BASE}/jobs`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockJob, ...body, id: 2 }, { status: 201 });
  }),

  http.put(`${BASE}/jobs/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockJob, ...body });
  }),

  http.patch(`${BASE}/jobs/:id/status`, () =>
    HttpResponse.json({ ...mockJob, status: 'in_progress' }),
  ),

  // ---- Lorry Receipts ----
  http.get(`${BASE}/lr`, () =>
    HttpResponse.json(mockPaginatedResponse([mockLR])),
  ),

  http.get(`${BASE}/lr/:id`, () => HttpResponse.json(mockLR)),

  http.post(`${BASE}/lr`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockLR, ...body, id: 2 }, { status: 201 });
  }),

  // ---- Trips ----
  http.get(`${BASE}/trips`, () =>
    HttpResponse.json(mockPaginatedResponse([mockTrip])),
  ),

  http.get(`${BASE}/trips/:id`, () => HttpResponse.json(mockTrip)),

  http.post(`${BASE}/trips`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockTrip, ...body, id: 2 }, { status: 201 });
  }),

  http.patch(`${BASE}/trips/:id/status`, () =>
    HttpResponse.json({ ...mockTrip, status: 'started' }),
  ),

  // ---- Finance / Invoices ----
  http.get(`${BASE}/invoices`, () =>
    HttpResponse.json(mockPaginatedResponse([mockInvoice])),
  ),

  http.get(`${BASE}/invoices/:id`, () => HttpResponse.json(mockInvoice)),

  http.post(`${BASE}/invoices`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockInvoice, ...body, id: 2 }, { status: 201 });
  }),

  http.post(`${BASE}/payments`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 1, ...body, status: 'completed' }, { status: 201 });
  }),

  // ---- Dashboard ----
  http.get(`${BASE}/dashboard/stats`, () =>
    HttpResponse.json({
      success: true,
      data: mockDashboardStats,
      message: 'ok',
    }),
  ),

  http.get(`${BASE}/reports/dashboard`, () =>
    HttpResponse.json({
      success: true,
      data: mockDashboardStats,
      message: 'ok',
    }),
  ),

  http.get(`${BASE}/dashboard/charts/revenue-trend`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { label: 'Jan', value: 500000, value2: 300000 },
        { label: 'Feb', value: 600000, value2: 350000 },
      ],
      message: 'ok',
    }),
  ),

  http.get(`${BASE}/dashboard/charts/expense-breakdown`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { label: 'Fuel', value: 200000 },
        { label: 'Maintenance', value: 100000 },
      ],
      message: 'ok',
    }),
  ),

  http.get(`${BASE}/dashboard/charts/fleet-utilization`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { label: 'Available', value: 15 },
        { label: 'On Trip', value: 8 },
      ],
      message: 'ok',
    }),
  ),

  http.get(`${BASE}/dashboard/notifications`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: '1', type: 'vehicle', message: 'Insurance expiring for KA01AB1234', severity: 'warning', read: false },
      ],
      message: 'ok',
    }),
  ),

  http.get(`${BASE}/dashboard/revenue-chart`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { month: 'Jan', revenue: 500000 },
        { month: 'Feb', revenue: 600000 },
      ],
      message: 'ok',
    }),
  ),

  http.get(`${BASE}/dashboard/alerts`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: 1, type: 'vehicle', message: 'Insurance expiring for KA01AB1234', severity: 'warning' },
      ],
      message: 'ok',
    }),
  ),
];
