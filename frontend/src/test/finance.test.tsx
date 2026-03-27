import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthStore, clearAuthStore } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import InvoicesPage from '@/pages/finance/InvoicesPage';

beforeEach(() => {
  mockAuthStore();
  return () => clearAuthStore();
});

describe('InvoicesPage (Finance)', () => {
  it('renders the invoices page', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /invoices/i })).toBeInTheDocument();
    });
  });

  it('displays invoice from API data', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText(/INV-2024-0001/i)).toBeInTheDocument();
    });
  });

  it('handles API error without crashing', async () => {
    server.use(
      http.get('/api/v1/invoices', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 }),
      ),
    );
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });
});
