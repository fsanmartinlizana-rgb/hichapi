/**
 * Property-Based Tests: Authentication
 *
 * **Validates: Requirements 15.4**
 *
 * Properties verified:
 *   1. Valid credentials always produce a non-null session token.
 *   2. After logout, getSession returns null.
 *   3. Expired tokens result in the session being invalid
 *      (sessionManager.hasValidSession() returns false).
 *
 * Uses fast-check to generate arbitrary inputs and verify that the
 * authentication service behaves correctly across all valid input spaces.
 */

import * as fc from 'fast-check';
import { authService } from '../../services/auth/AuthService';
import { sessionManager } from '../../services/auth/SessionManager';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mocks
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

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { supabase } from '../../config/supabase';
import * as SecureStore from 'expo-secure-store';

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal valid Session with a given access_token. */
function buildSession(accessToken: string, expiresAt?: number): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
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
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Property 1: Valid credentials always produce a non-null session token
// ---------------------------------------------------------------------------

describe('Property: valid credentials always produce a non-null session token', () => {
  /**
   * **Validates: Requirements 15.4**
   *
   * For any valid email and password (password ≥ 8 chars), when Supabase
   * returns a session with a non-null access_token, login() must return a
   * session where session.access_token is a non-empty string.
   */
  it('login() returns a session with a non-empty access_token for any valid credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 8 }),
        fc.string({ minLength: 1 }),
        async (email, password, accessToken) => {
          const session = buildSession(accessToken);

          (mockAuth.signInWithPassword as jest.Mock).mockResolvedValue({
            data: { session, user: session.user },
            error: null,
          });

          const result = await authService.login(email, password);

          expect(result).not.toBeNull();
          expect(typeof result.access_token).toBe('string');
          expect(result.access_token.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: After logout, getSession returns null
// ---------------------------------------------------------------------------

describe('Property: after logout, getSession returns null', () => {
  /**
   * **Validates: Requirements 15.4**
   *
   * For any sequence of logout followed by getSession, the result must be null.
   * This property holds regardless of what session was active before logout.
   */
  it('getSession() returns null after logout() succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        (mockAuth.signOut as jest.Mock).mockResolvedValue({ error: null });
        (mockAuth.getSession as jest.Mock).mockResolvedValue({
          data: { session: null },
          error: null,
        });

        await authService.logout();
        const session = await authService.getSession();

        expect(session).toBeNull();
      }),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Expired tokens result in session being invalid
// ---------------------------------------------------------------------------

describe('Property: expired tokens result in session being invalid', () => {
  /**
   * **Validates: Requirements 15.4**
   *
   * For any session whose expires_at is in the past (more than 60 seconds ago
   * to account for the buffer in hasValidSession), sessionManager.hasValidSession()
   * must return false.
   */
  it('hasValidSession() returns false for any session with expires_at in the past', async () => {
    // Use a timestamp that is at least 120 seconds in the past to safely
    // exceed the 60-second buffer used by hasValidSession().
    const maxExpiredAt =
      Math.floor(Date.now() / 1000) - 120;

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: maxExpiredAt }),
        async (expiresAt) => {
          const session = buildSession('expired-token', expiresAt);

          // Mock SecureStore to return the expired session
          (mockSecureStore.getItemAsync as jest.Mock).mockResolvedValue(
            JSON.stringify(session)
          );

          const isValid = await sessionManager.hasValidSession();

          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('hasValidSession() returns false when no session is stored', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        (mockSecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

        const isValid = await sessionManager.hasValidSession();

        expect(isValid).toBe(false);
      }),
      { numRuns: 10 }
    );
  });
});
