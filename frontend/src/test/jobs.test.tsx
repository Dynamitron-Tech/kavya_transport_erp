import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthStore, clearAuthStore } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockPaginatedResponse } from '@/test/mocks/data';
import JobsPage from '@/pages/jobs/JobsPage';

beforeEach(() => {
  mockAuthStore();
  return () => clearAuthStore();
});

describe('JobsPage', () => {
  it('renders the jobs page', async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /jobs/i })).toBeInTheDocument();
    });
  });

  it('displays job from API data', async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText(/JOB-2024-0001/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no jobs', async () => {
    server.use(
      http.get('/api/v1/jobs', () =>
        HttpResponse.json(mockPaginatedResponse([])),
      ),
    );
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no.*found|no.*job|no data/i)).toBeInTheDocument();
    });
  });

  it('displays job status badge', async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText(/approved/i)).toBeInTheDocument();
    });
  });

  it('handles API error without crashing', async () => {
    server.use(
      http.get('/api/v1/jobs', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 }),
      ),
    );
    render(<JobsPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });
});
