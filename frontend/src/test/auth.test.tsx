import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test/utils';
import { useAuthStore } from '@/store/authStore';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import LoginPage from '@/pages/auth/LoginPage';

beforeEach(() => {
  useAuthStore.setState({
    token: null,
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
});

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('admin@transporterp.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('shows validation when submitting empty form', async () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText('admin@transporterp.com') as HTMLInputElement;
    expect(emailInput).toBeRequired();
  });

  it('successful login populates auth store', async () => {
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('admin@transporterp.com'), 'admin@kavyatransports.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'admin123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('test-token');
    });
  });

  it('shows error message on login failure', async () => {
    server.use(
      http.post('/api/v1/auth/login', () =>
        HttpResponse.json(
          { detail: 'Invalid credentials' },
          { status: 401 },
        ),
      ),
    );

    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('admin@transporterp.com'), 'wrong@test.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
    });
  });
});
