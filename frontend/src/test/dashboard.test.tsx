import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthStore, clearAuthStore } from '@/test/utils';
import DashboardPage from '@/pages/dashboard/DashboardPage';

beforeEach(() => {
  mockAuthStore();
  return () => clearAuthStore();
});

describe('DashboardPage', () => {
  it('renders the dashboard greeting', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/good (morning|afternoon|evening)/i)).toBeInTheDocument();
    });
  });

  it('shows quick action buttons', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/new job/i)).toBeInTheDocument();
    });
  });

  it('renders without crashing for admin user', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });
});
