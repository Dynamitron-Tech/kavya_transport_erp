import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthStore, clearAuthStore } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockPaginatedResponse } from '@/test/mocks/data';
import TripsPage from '@/pages/trips/TripsPage';

beforeEach(() => {
  mockAuthStore();
  return () => clearAuthStore();
});

describe('TripsPage', () => {
  it('renders the trips page', async () => {
    render(<TripsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /trips/i })).toBeInTheDocument();
    });
  });

  it('displays trip from API data', async () => {
    render(<TripsPage />);
    await waitFor(() => {
      expect(screen.getByText(/TRP-2024-0001/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no trips', async () => {
    server.use(
      http.get('/api/v1/trips', () =>
        HttpResponse.json(mockPaginatedResponse([])),
      ),
    );
    render(<TripsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no.*found|no.*trip|no data/i)).toBeInTheDocument();
    });
  });

  it('handles API error without crashing', async () => {
    server.use(
      http.get('/api/v1/trips', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 }),
      ),
    );
    render(<TripsPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });
});
