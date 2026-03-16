import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthStore, clearAuthStore } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockPaginatedResponse } from '@/test/mocks/data';
import DriversPage from '@/pages/drivers/DriversPage';

beforeEach(() => {
  mockAuthStore();
  return () => clearAuthStore();
});

describe('DriversPage', () => {
  it('renders the drivers page', async () => {
    render(<DriversPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /drivers/i })).toBeInTheDocument();
    });
  });

  it('displays driver from API data', async () => {
    render(<DriversPage />);
    await waitFor(() => {
      expect(screen.getByText('Raju Kumar')).toBeInTheDocument();
    });
  });

  it('shows empty state when no drivers', async () => {
    server.use(
      http.get('/api/v1/drivers', () =>
        HttpResponse.json(mockPaginatedResponse([])),
      ),
    );
    render(<DriversPage />);
    await waitFor(() => {
      expect(screen.getByText(/no.*found|no.*driver|no data/i)).toBeInTheDocument();
    });
  });
});
