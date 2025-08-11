import { shortenUrl, getDomains, addDomain, verifyDomain } from '../api';

// Mock the global fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('shortenUrl', () => {
    test('successfully shortens URL', async () => {
      const mockResponse = {
        short_url: 'https://thalora.dev/abc123',
        original_url: 'https://example.com'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await shortenUrl({
        url: 'https://example.com',
        domain: undefined
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          url: 'https://example.com',
          domain: undefined
        }),
      });
    });

    test('shortens URL with custom domain', async () => {
      const mockResponse = {
        short_url: 'https://custom.com/abc123',
        original_url: 'https://example.com'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await shortenUrl({
        url: 'https://example.com',
        domain: 'custom.com'
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          url: 'https://example.com',
          domain: 'custom.com'
        }),
      });
    });

    test('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid URL format' }),
      } as Response);

      await expect(shortenUrl({
        url: 'invalid-url',
        domain: undefined
      })).rejects.toThrow('Invalid URL format');
    });

    test('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(shortenUrl({
        url: 'https://example.com',
        domain: undefined
      })).rejects.toThrow('Network error');
    });

    test('handles authentication required error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Authentication required' }),
      } as Response);

      await expect(shortenUrl({
        url: 'https://example.com',
        domain: undefined
      })).rejects.toThrow('Authentication required');
    });
  });

  describe('getDomains', () => {
    test('successfully gets domains list', async () => {
      const mockDomains = [
        {
          id: 1,
          domain_name: 'example.com',
          is_verified: true,
          verification_status: 'Verified',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          domain_name: 'test.com',
          is_verified: false,
          verification_status: 'Pending verification',
          created_at: '2024-01-02T00:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDomains),
      } as Response);

      const result = await getDomains();

      expect(result).toEqual(mockDomains);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/api/domains', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
    });

    test('handles empty domains list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const result = await getDomains();
      expect(result).toEqual([]);
    });
  });

  describe('addDomain', () => {
    test('successfully adds domain', async () => {
      const mockResponse = {
        id: 1,
        domain_name: 'example.com',
        is_verified: false,
        verification_status: 'Domain validation pending. Please create a TXT record: _thalora-verification.example.com with value: thalora-verification-abc123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await addDomain('example.com');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          domain_name: 'example.com'
        }),
      });
    });

    test('handles domain already exists error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Domain already exists' }),
      } as Response);

      await expect(addDomain('existing.com'))
        .rejects.toThrow('Domain already exists');
    });

    test('handles invalid domain format error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid domain format' }),
      } as Response);

      await expect(addDomain('invalid..domain'))
        .rejects.toThrow('Invalid domain format');
    });
  });

  describe('verifyDomain', () => {
    test('successfully verifies domain', async () => {
      const mockResponse = {
        id: 1,
        domain_name: 'example.com',
        is_verified: true,
        verification_status: 'Domain successfully verified!'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await verifyDomain(1);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/api/domains/1/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
    });

    test('handles domain not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Domain not found' }),
      } as Response);

      await expect(verifyDomain(999))
        .rejects.toThrow('Domain not found');
    });

    test('handles verification failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ 
          error: 'Domain verification failed. Please ensure the TXT record _thalora-verification.example.com contains the value: thalora-verification-abc123'
        }),
      } as Response);

      await expect(verifyDomain(1))
        .rejects.toThrow('Domain verification failed');
    });

    test('handles already verified domain', async () => {
      const mockResponse = {
        id: 1,
        domain_name: 'example.com',
        is_verified: true,
        verification_status: 'Domain is already verified'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await verifyDomain(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('API configuration', () => {
    test('uses correct base URL', () => {
      // The API base URL should be configurable
      const expectedBaseUrl = 'http://localhost:8080';
      
      shortenUrl({ url: 'https://example.com', domain: undefined });
      
      const callUrl = (mockFetch.mock.calls[0] as any)[0];
      expect(callUrl).toStartWith(expectedBaseUrl);
    });

    test('includes credentials in all requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await shortenUrl({ url: 'https://example.com', domain: undefined });
      await getDomains();
      await addDomain('example.com');
      await verifyDomain(1);

      // Check that all calls include credentials
      mockFetch.mock.calls.forEach(call => {
        const options = call[1] as RequestInit;
        expect(options.credentials).toBe('include');
      });
    });

    test('includes correct headers in all requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await shortenUrl({ url: 'https://example.com', domain: undefined });
      await getDomains();
      await addDomain('example.com');
      await verifyDomain(1);

      // Check that all calls include correct headers
      mockFetch.mock.calls.forEach(call => {
        const options = call[1] as RequestInit;
        expect(options.headers).toEqual({
          'Content-Type': 'application/json',
        });
      });
    });
  });

  describe('Error handling', () => {
    test('handles JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      await expect(getDomains()).rejects.toThrow('Invalid JSON');
    });

    test('handles fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));

      await expect(getDomains()).rejects.toThrow('Fetch failed');
    });

    test('handles server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      } as Response);

      await expect(getDomains()).rejects.toThrow('Internal Server Error');
    });
  });
});