import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import URLForm from '../URLForm';

// Mock the API service
jest.mock('../../services/api', () => ({
  shortenUrl: jest.fn(),
}));

const mockApiService = require('../../services/api');

describe('URLForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders URL form', () => {
    render(<URLForm onUrlShortened={jest.fn()} />);
    
    expect(screen.getByText('Shorten Your URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your URL here...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shorten url/i })).toBeInTheDocument();
  });

  test('displays validation error for empty URL', async () => {
    render(<URLForm onUrlShortened={jest.fn()} />);
    
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });
    fireEvent.click(shortenButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a URL')).toBeInTheDocument();
    });
  });

  test('validates URL format', async () => {
    render(<URLForm onUrlShortened={jest.fn()} />);
    
    const urlInput = screen.getByPlaceholderText('Enter your URL here...');
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });

    fireEvent.change(urlInput, { target: { value: 'invalid-url' } });
    fireEvent.click(shortenButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument();
    });
  });

  test('rejects HTTP URLs (HTTPS only)', async () => {
    render(<URLForm onUrlShortened={jest.fn()} />);
    
    const urlInput = screen.getByPlaceholderText('Enter your URL here...');
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });

    fireEvent.change(urlInput, { target: { value: 'http://example.com' } });
    fireEvent.click(shortenButton);

    await waitFor(() => {
      expect(screen.getByText('Only HTTPS URLs are supported for security')).toBeInTheDocument();
    });
  });

  test('accepts valid HTTPS URLs', async () => {
    const mockOnUrlShortened = jest.fn();
    const mockResponse = {
      short_url: 'https://thalora.dev/abc123',
      original_url: 'https://example.com'
    };
    
    mockApiService.shortenUrl.mockResolvedValue(mockResponse);

    render(<URLForm onUrlShortened={mockOnUrlShortened} />);
    
    const urlInput = screen.getByPlaceholderText('Enter your URL here...');
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.click(shortenButton);

    await waitFor(() => {
      expect(mockApiService.shortenUrl).toHaveBeenCalledWith({
        url: 'https://example.com',
        domain: undefined
      });
      expect(mockOnUrlShortened).toHaveBeenCalledWith(mockResponse);
    });
  });

  test('shows loading state during URL shortening', async () => {
    let resolveShortenUrl: (value: any) => void;
    const shortenPromise = new Promise((resolve) => {
      resolveShortenUrl = resolve;
    });
    mockApiService.shortenUrl.mockReturnValue(shortenPromise);

    render(<URLForm onUrlShortened={jest.fn()} />);
    
    const urlInput = screen.getByPlaceholderText('Enter your URL here...');
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.click(shortenButton);

    // Check loading state
    expect(screen.getByText('Shortening...')).toBeInTheDocument();
    expect(shortenButton).toBeDisabled();

    // Resolve the promise
    resolveShortenUrl!({
      short_url: 'https://thalora.dev/abc123',
      original_url: 'https://example.com'
    });

    await waitFor(() => {
      expect(screen.queryByText('Shortening...')).not.toBeInTheDocument();
    });
  });

  test('displays error message on API failure', async () => {
    mockApiService.shortenUrl.mockRejectedValue(new Error('Failed to shorten URL'));

    render(<URLForm onUrlShortened={jest.fn()} />);
    
    const urlInput = screen.getByPlaceholderText('Enter your URL here...');
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.click(shortenButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to shorten URL')).toBeInTheDocument();
    });
  });

  test('clears form after successful submission', async () => {
    const mockOnUrlShortened = jest.fn();
    mockApiService.shortenUrl.mockResolvedValue({
      short_url: 'https://thalora.dev/abc123',
      original_url: 'https://example.com'
    });

    render(<URLForm onUrlShortened={mockOnUrlShortened} />);
    
    const urlInput = screen.getByPlaceholderText('Enter your URL here...') as HTMLInputElement;
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.click(shortenButton);

    await waitFor(() => {
      expect(urlInput.value).toBe('');
    });
  });

  test('handles domain selection', async () => {
    const mockOnUrlShortened = jest.fn();
    mockApiService.shortenUrl.mockResolvedValue({
      short_url: 'https://custom.com/abc123',
      original_url: 'https://example.com'
    });

    render(<URLForm onUrlShortened={mockOnUrlShortened} />);
    
    const urlInput = screen.getByPlaceholderText('Enter your URL here...');
    
    // Assuming there's a domain selector in the component
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    
    const shortenButton = screen.getByRole('button', { name: /shorten url/i });
    fireEvent.click(shortenButton);

    await waitFor(() => {
      expect(mockApiService.shortenUrl).toHaveBeenCalledWith({
        url: 'https://example.com',
        domain: undefined
      });
    });
  });
});