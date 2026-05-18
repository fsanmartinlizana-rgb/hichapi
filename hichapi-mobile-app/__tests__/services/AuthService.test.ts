/**
 * Unit Tests: AuthService
 *
 * Tests the AuthService methods by mocking the Supabase client.
 * Covers login, logout, getSession, refreshSession, recoverPassword,
 * and onAuthStateChange.
 */

import { authService } from '../../services/auth/AuthService';
import { supabase } from '../../config/supabase';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockSupabaseAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;

/** Builds a minimal valid Session object for use in tests. */
function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: 'user-id-123',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------

describe('AuthService.login()', () => {
  it('returns session on successful login', async () => {
    const session = buildSession();
    (mockSupabaseAuth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    const result = await authService.login('user@example.com', 'password123');

    expect(result).toEqual(session);
    expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('throws "Login failed" when Supabase returns an error', async () => {
    (mockSupabaseAuth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid credentials' },
    });

    await expect(
      authService.login('user@example.com', 'wrongpassword')
    ).rejects.toThrow('Login failed: Invalid credentials');
  });

  it('throws "Login failed: no session returned" when data.session is null', async () => {
    (mockSupabaseAuth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    await expect(
      authService.login('user@example.com', 'password123')
    ).rejects.toThrow('Login failed: no session returned');
  });
});

// ---------------------------------------------------------------------------
// logout()
// ---------------------------------------------------------------------------

describe('AuthService.logout()', () => {
  it('resolves without error on success', async () => {
    (mockSupabaseAuth.signOut as jest.Mock).mockResolvedValue({ error: null });

    await expect(authService.logout()).resolves.toBeUndefined();
    expect(mockSupabaseAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('throws "Logout failed" when Supabase returns an error', async () => {
    (mockSupabaseAuth.signOut as jest.Mock).mockResolvedValue({
      error: { message: 'Network error' },
    });

    await expect(authService.logout()).rejects.toThrow(
      'Logout failed: Network error'
    );
  });
});

// ---------------------------------------------------------------------------
// getSession()
// ---------------------------------------------------------------------------

describe('AuthService.getSession()', () => {
  it('returns session when one exists', async () => {
    const session = buildSession();
    (mockSupabaseAuth.getSession as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    const result = await authService.getSession();

    expect(result).toEqual(session);
  });

  it('returns null when no session exists', async () => {
    (mockSupabaseAuth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const result = await authService.getSession();

    expect(result).toBeNull();
  });

  it('throws when Supabase returns an error', async () => {
    (mockSupabaseAuth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: { message: 'Session retrieval failed' },
    });

    await expect(authService.getSession()).rejects.toThrow(
      'Failed to retrieve session: Session retrieval failed'
    );
  });
});

// ---------------------------------------------------------------------------
// refreshSession()
// ---------------------------------------------------------------------------

describe('AuthService.refreshSession()', () => {
  it('returns refreshed session on success', async () => {
    const session = buildSession({ access_token: 'new-access-token' });
    (mockSupabaseAuth.refreshSession as jest.Mock).mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    const result = await authService.refreshSession();

    expect(result).toEqual(session);
    expect(result.access_token).toBe('new-access-token');
  });

  it('throws when Supabase returns an error', async () => {
    (mockSupabaseAuth.refreshSession as jest.Mock).mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Token expired' },
    });

    await expect(authService.refreshSession()).rejects.toThrow(
      'Session refresh failed: Token expired'
    );
  });

  it('throws "no session returned" when data.session is null', async () => {
    (mockSupabaseAuth.refreshSession as jest.Mock).mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    await expect(authService.refreshSession()).rejects.toThrow(
      'Session refresh failed: no session returned'
    );
  });
});

// ---------------------------------------------------------------------------
// recoverPassword()
// ---------------------------------------------------------------------------

describe('AuthService.recoverPassword()', () => {
  it('resolves without error on success', async () => {
    (mockSupabaseAuth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
      data: {},
      error: null,
    });

    await expect(
      authService.recoverPassword('user@example.com')
    ).resolves.toBeUndefined();
    expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com'
    );
  });

  it('throws "Password recovery failed" when Supabase returns an error', async () => {
    (mockSupabaseAuth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
      data: {},
      error: { message: 'Email not found' },
    });

    await expect(
      authService.recoverPassword('unknown@example.com')
    ).rejects.toThrow('Password recovery failed: Email not found');
  });
});

// ---------------------------------------------------------------------------
// onAuthStateChange()
// ---------------------------------------------------------------------------

describe('AuthService.onAuthStateChange()', () => {
  it('calls the callback when auth state changes', () => {
    const session = buildSession();
    const unsubscribeFn = jest.fn();
    const subscription = { unsubscribe: unsubscribeFn };

    // Simulate Supabase calling the listener immediately with a session
    (mockSupabaseAuth.onAuthStateChange as jest.Mock).mockImplementation(
      (listener) => {
        listener('SIGNED_IN', session);
        return { data: { subscription } };
      }
    );

    const callback = jest.fn();
    authService.onAuthStateChange(callback);

    expect(callback).toHaveBeenCalledWith(session);
  });

  it('returns an unsubscribe function that calls subscription.unsubscribe()', () => {
    const unsubscribeFn = jest.fn();
    const subscription = { unsubscribe: unsubscribeFn };

    (mockSupabaseAuth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription },
    });

    const callback = jest.fn();
    const unsubscribe = authService.onAuthStateChange(callback);

    expect(typeof unsubscribe).toBe('function');

    unsubscribe();

    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
  });
});
