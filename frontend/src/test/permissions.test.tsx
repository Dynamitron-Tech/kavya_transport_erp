import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { mockUser, mockDriverUser } from '@/test/mocks/data';

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

describe('Permission helpers (authStore)', () => {
  it('admin has all permissions via wildcard', () => {
    useAuthStore.setState({
      token: 'test-token',
      user: mockUser,
      permissions: mockUser.permissions,
      isAuthenticated: true,
    });

    const { hasPermission } = useAuthStore.getState();
    expect(hasPermission('clients:read')).toBe(true);
    expect(hasPermission('finance:write')).toBe(true);
    expect(hasPermission('anything:any')).toBe(true);
  });

  it('driver only has assigned permissions', () => {
    useAuthStore.setState({
      token: 'test-token',
      user: mockDriverUser,
      permissions: mockDriverUser.permissions,
      isAuthenticated: true,
    });

    const { hasPermission } = useAuthStore.getState();
    expect(hasPermission('trips:view')).toBe(true);
    expect(hasPermission('trips:update_status')).toBe(true);
    expect(hasPermission('finance:write')).toBe(false);
    expect(hasPermission('clients:read')).toBe(false);
  });

  it('hasRole correctly identifies roles', () => {
    useAuthStore.setState({
      token: 'test-token',
      user: mockUser,
      permissions: mockUser.permissions,
      isAuthenticated: true,
    });

    const { hasRole, hasAnyRole } = useAuthStore.getState();
    expect(hasRole('admin')).toBe(true);
    expect(hasRole('driver')).toBe(false);
    expect(hasAnyRole(['admin', 'manager'])).toBe(true);
    expect(hasAnyRole(['driver', 'fleet_manager'])).toBe(false);
  });

  it('unauthenticated user has no permissions', () => {
    const { hasPermission, hasRole } = useAuthStore.getState();
    expect(hasPermission('anything')).toBe(false);
    expect(hasRole('admin')).toBe(false);
  });
});
