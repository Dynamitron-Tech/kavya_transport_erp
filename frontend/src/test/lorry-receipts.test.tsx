import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthStore, clearAuthStore } from '@/test/utils';
import LRListPage from '@/pages/lr/LRListPage';

beforeEach(() => {
  mockAuthStore();
  return () => clearAuthStore();
});

describe('LRListPage', () => {
  it('renders the LR page', async () => {
    render(<LRListPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /lorry receipts/i })).toBeInTheDocument();
    });
  });

  it('displays LR from API data', async () => {
    render(<LRListPage />);
    await waitFor(() => {
      expect(screen.getByText(/LR-2024-0001/i)).toBeInTheDocument();
    });
  });
});
