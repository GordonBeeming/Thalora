import { loginWithPasskey, registerWithPasskey, getCurrentUser, logout } from '../auth';

// Mock the global fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock WebAuthn API
const mockCredentials = {
  create: jest.fn(),
  get: jest.fn(),
};

Object.defineProperty(global.navigator, 'credentials', {
  value: mockCredentials,
  writable: true,
});

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('WebAuthn Support Detection', () => {
    test('detects WebAuthn support', () => {
      expect(typeof navigator.credentials).toBe('object');
      expect(typeof navigator.credentials.create).toBe('function');
      expect(typeof navigator.credentials.get).toBe('function');
    });
  });

  describe('registerWithPasskey', () => {
    test('successfully registers with passkey', async () => {
      // Mock the register/begin response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge: 'mock-challenge',
          user_id: 'mock-user-id',
          timeout: 60000,
          rp: { id: 'localhost', name: 'Thalora' },
          user: { id: 'mock-user-id', name: 'testuser', display_name: 'Test User' },
          pub_key_cred_params: [{ alg: -7, type: 'public-key' }],
          authenticator_selection: {
            authenticator_attachment: null,
            require_resident_key: false,
            resident_key: 'preferred',
            user_verification: 'preferred'
          },
          attestation: 'none'
        }),
      } as Response);

      // Mock navigator.credentials.create
      mockCredentials.create.mockResolvedValueOnce({
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        type: 'public-key',
        response: {
          clientDataJSON: 'mock-client-data',
          attestationObject: 'mock-attestation-object',
        },
      });

      // Mock the register/complete response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user_id: 1,
          username: 'testuser',
          email: 'test@example.com',
        }),
      } as Response);

      const result = await registerWithPasskey('testuser', 'test@example.com');

      expect(result).toEqual({
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockCredentials.create).toHaveBeenCalledTimes(1);
    });

    test('handles registration begin failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Username already exists' }),
      } as Response);

      await expect(registerWithPasskey('existinguser', 'test@example.com'))
        .rejects.toThrow('Username already exists');
    });

    test('handles WebAuthn create failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge: 'mock-challenge',
          user_id: 'mock-user-id',
          timeout: 60000,
          rp: { id: 'localhost', name: 'Thalora' },
          user: { id: 'mock-user-id', name: 'testuser', display_name: 'Test User' },
          pub_key_cred_params: [{ alg: -7, type: 'public-key' }],
          authenticator_selection: {},
          attestation: 'none'
        }),
      } as Response);

      mockCredentials.create.mockRejectedValueOnce(new Error('User cancelled'));

      await expect(registerWithPasskey('testuser', 'test@example.com'))
        .rejects.toThrow('User cancelled');
    });

    test('handles registration complete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge: 'mock-challenge',
          user_id: 'mock-user-id',
          timeout: 60000,
          rp: { id: 'localhost', name: 'Thalora' },
          user: { id: 'mock-user-id', name: 'testuser', display_name: 'Test User' },
          pub_key_cred_params: [{ alg: -7, type: 'public-key' }],
          authenticator_selection: {},
          attestation: 'none'
        }),
      } as Response);

      mockCredentials.create.mockResolvedValueOnce({
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        type: 'public-key',
        response: {
          clientDataJSON: 'mock-client-data',
          attestationObject: 'mock-attestation-object',
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credential' }),
      } as Response);

      await expect(registerWithPasskey('testuser', 'test@example.com'))
        .rejects.toThrow('Invalid credential');
    });
  });

  describe('loginWithPasskey', () => {
    test('successfully logs in with passkey', async () => {
      // Mock the login/begin response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge: 'mock-challenge',
          timeout: 60000,
          rp_id: 'localhost',
          allow_credentials: [{
            id: 'mock-credential-id',
            type: 'public-key',
            transports: ['internal']
          }]
        }),
      } as Response);

      // Mock navigator.credentials.get
      mockCredentials.get.mockResolvedValueOnce({
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        type: 'public-key',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-authenticator-data',
          signature: 'mock-signature',
          userHandle: null,
        },
      });

      // Mock the login/complete response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user_id: 1,
          username: 'testuser',
          email: 'test@example.com',
        }),
      } as Response);

      const result = await loginWithPasskey('testuser');

      expect(result).toEqual({
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockCredentials.get).toHaveBeenCalledTimes(1);
    });

    test('handles login begin failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'User not found' }),
      } as Response);

      await expect(loginWithPasskey('nonexistent'))
        .rejects.toThrow('User not found');
    });

    test('handles WebAuthn get failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          challenge: 'mock-challenge',
          timeout: 60000,
          rp_id: 'localhost',
          allow_credentials: []
        }),
      } as Response);

      mockCredentials.get.mockRejectedValueOnce(new Error('User cancelled'));

      await expect(loginWithPasskey('testuser'))
        .rejects.toThrow('User cancelled');
    });
  });

  describe('getCurrentUser', () => {
    test('successfully gets current user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user_id: 1,
          username: 'testuser',
          email: 'test@example.com',
          created_at: '2024-01-01T00:00:00Z'
        }),
      } as Response);

      const result = await getCurrentUser();

      expect(result).toEqual({
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z'
      });
    });

    test('returns null when not authenticated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Not authenticated' }),
      } as Response);

      const result = await getCurrentUser();
    test('throws when not authenticated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Not authenticated' }),
      } as Response);

      await expect(getCurrentUser()).rejects.toThrow('Not authenticated');
    });
  });

  describe('logout', () => {
    test('successfully logs out', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Logged out successfully' }),
      } as Response);

      await expect(logout()).resolves.toBeUndefined();
    });

    test('handles logout failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Logout failed' }),
      } as Response);

      await expect(logout()).rejects.toThrow('Logout failed');
    });
  });

  describe('Base64 URL-safe encoding/decoding', () => {
    // These functions should be available in the auth service
    test('encodes and decodes base64 URL-safe strings', () => {
      // Mock implementation for testing
      const encodeBase64UrlSafe = (buffer: ArrayBuffer): string => {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      };

      const decodeBase64UrlSafe = (str: string): ArrayBuffer => {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) {
          str += '=';
        }
        const bytes = new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
        return bytes.buffer;
      };

      const originalData = new TextEncoder().encode('Hello, World!');
      const encoded = encodeBase64UrlSafe(originalData.buffer);
      const decoded = new Uint8Array(decodeBase64UrlSafe(encoded));

      expect(new TextDecoder().decode(decoded)).toBe('Hello, World!');
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });
  });

  describe('Error handling', () => {
    test('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(registerWithPasskey('testuser', 'test@example.com'))
        .rejects.toThrow('Network error');
    });

    test('handles JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      await expect(registerWithPasskey('testuser', 'test@example.com'))
        .rejects.toThrow('Invalid JSON');
    });

    test('handles WebAuthn not supported', async () => {
      // Temporarily remove WebAuthn support
      const originalCredentials = navigator.credentials;
      delete (navigator as any).credentials;

      await expect(registerWithPasskey('testuser', 'test@example.com'))
        .rejects.toThrow('WebAuthn is not supported in this browser');

      // Restore WebAuthn support
      Object.defineProperty(navigator, 'credentials', {
        value: originalCredentials,
        writable: true,
      });
    });
  });
});