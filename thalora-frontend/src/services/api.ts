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

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

/**
 * Custom error class for API errors
 */
export class ThaloriApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ThaloriApiError';
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

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      throw new ThaloriApiError(error.error || 'An error occurred while shortening the URL', response.status);
    }

    return data as ShortenUrlResponse;
  } catch (error) {
    if (error instanceof ThaloriApiError) {
      throw error;
    }

    // Handle network errors or other fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ThaloriApiError('Unable to connect to the server. Please check your connection.', 0);
    }

    // Re-throw other errors
    throw new ThaloriApiError('An unexpected error occurred', 0);
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