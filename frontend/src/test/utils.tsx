import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { mockUser } from './mocks/data';
import type { User } from '@/types';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/** Populate the Zustand auth store for tests that need an authenticated user */
function mockAuthStore(user: User = mockUser) {
  useAuthStore.setState({
    token: 'test-token',
    user,
    permissions: user.permissions,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

/** Clear the auth store after tests */
function clearAuthStore() {
  useAuthStore.setState({
    token: null,
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Override render
export { customRender as render, mockAuthStore, clearAuthStore, createTestQueryClient };
