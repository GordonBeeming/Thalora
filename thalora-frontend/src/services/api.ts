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

    // Check if we got a response
    if (!response) {
      throw new ThaloriApiError('No response received from server', 0);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new ThaloriApiError('Invalid response format from server', response.status);
    }

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

    // Log the actual error for debugging
    console.error('Unexpected error in shortenUrl:', error);
    
    // Re-throw other errors with more context
    throw new ThaloriApiError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
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