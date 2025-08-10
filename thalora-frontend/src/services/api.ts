/**
 * API service for communicating with the Thalora backend
 */

// Types for API communication
export interface ShortenUrlRequest {
  url: string;
}

export interface ShortenUrlResponse {
  short_url: string;
  original_url: string;
}

export interface ApiError {
  error: string;
}

export interface DomainEntry {
  id: number;
  user_id?: number;
  domain_name: string;
  is_verified: boolean;
  verification_token?: string;
  created_at: string;
  updated_at: string;
}

export interface AddDomainRequest {
  domain_name: string;
}

export interface AddDomainResponse {
  id: number;
  domain_name: string;
  is_verified: boolean;
  verification_status: string;
}

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

/**
 * Custom error class for API errors
 */
export class ThaloraApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ThaloraApiError';
  }
}

/**
 * Makes a request to the backend API to shorten a URL
 */
export async function shortenUrl(url: string): Promise<ShortenUrlResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url } as ShortenUrlRequest),
    });

    // Check if we got a response
    if (!response) {
      throw new ThaloraApiError('No response received from server', 0);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new ThaloraApiError('Invalid response format from server', response.status);
    }

    if (!response.ok) {
      const error = data as ApiError;
      throw new ThaloraApiError(error.error || 'An error occurred while shortening the URL', response.status);
    }

    return data as ShortenUrlResponse;
  } catch (error) {
    if (error instanceof ThaloraApiError) {
      throw error;
    }

    // Handle network errors or other fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ThaloraApiError('Unable to connect to the server. Please check your connection.', 0);
    }

    // Log the actual error for debugging
    console.error('Unexpected error in shortenUrl:', error);
    
    // Re-throw other errors with more context
    throw new ThaloraApiError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
  }
}

/**
 * Checks if the API backend is healthy and reachable
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Adds a new domain for custom URL shortening
 */
export async function addDomain(domainName: string): Promise<AddDomainResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/domains`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain_name: domainName } as AddDomainRequest),
    });

    if (!response) {
      throw new ThaloraApiError('No response received from server', 0);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new ThaloraApiError('Invalid response format from server', response.status);
    }

    if (!response.ok) {
      const error = data as ApiError;
      throw new ThaloraApiError(error.error || 'An error occurred while adding the domain', response.status);
    }

    return data as AddDomainResponse;
  } catch (error) {
    if (error instanceof ThaloraApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ThaloraApiError('Unable to connect to the server. Please check your connection.', 0);
    }

    console.error('Unexpected error in addDomain:', error);
    throw new ThaloraApiError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
  }
}

/**
 * Gets list of verified domains
 */
export async function listDomains(): Promise<DomainEntry[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/domains`, {
      method: 'GET',
    });

    if (!response) {
      throw new ThaloraApiError('No response received from server', 0);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new ThaloraApiError('Invalid response format from server', response.status);
    }

    if (!response.ok) {
      const error = data as ApiError;
      throw new ThaloraApiError(error.error || 'An error occurred while fetching domains', response.status);
    }

    return data as DomainEntry[];
  } catch (error) {
    if (error instanceof ThaloraApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ThaloraApiError('Unable to connect to the server. Please check your connection.', 0);
    }

    console.error('Unexpected error in listDomains:', error);
    throw new ThaloraApiError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
  }
}