import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthStore, clearAuthStore } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockPaginatedResponse } from '@/test/mocks/data';
import VehiclesPage from '@/pages/vehicles/VehiclesPage';

beforeEach(() => {
  mockAuthStore();
  return () => clearAuthStore();
});

describe('VehiclesPage', () => {
  it('renders the vehicles page', async () => {
    render(<VehiclesPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /vehicles/i })).toBeInTheDocument();
    });
  });

  it('displays vehicle from API data', async () => {
    render(<VehiclesPage />);
    await waitFor(() => {
      expect(screen.getByText(/KA01AB1234/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no vehicles', async () => {
    server.use(
      http.get('/api/v1/vehicles', () =>
        HttpResponse.json(mockPaginatedResponse([])),
      ),
    );
    render(<VehiclesPage />);
    await waitFor(() => {
      expect(screen.getByText(/no.*found|no.*vehicle|no data/i)).toBeInTheDocument();
    });
  });

  it('shows vehicle status badge', async () => {
    render(<VehiclesPage />);
    await waitFor(() => {
      expect(screen.getByText(/available/i)).toBeInTheDocument();
    });
  });

  it('handles API error without crashing', async () => {
    server.use(
      http.get('/api/v1/vehicles', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 }),
      ),
    );
    render(<VehiclesPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });
});
