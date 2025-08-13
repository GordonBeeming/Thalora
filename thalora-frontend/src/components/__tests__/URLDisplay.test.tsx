import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import URLDisplay from '../URLDisplay';

describe('URLDisplay Component - Redirect Testing', () => {
  const mockProps = {
    originalUrl: 'https://www.example.com/test-page',
    shortenedUrl: 'http://localhost:8080/shortened-url/abc123',
    onCopySuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock navigator.clipboard
    const mockClipboard = {
      writeText: jest.fn(() => Promise.resolve()),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    });

    // Mock window.open for testing the Test Link button
    global.open = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders URL display with shortened URL and original URL', () => {
    render(<URLDisplay {...mockProps} />);
    
    // Check that the shortened URL is displayed in the input field
    const urlInput = screen.getByDisplayValue(mockProps.shortenedUrl);
    expect(urlInput).toBeInTheDocument();
    expect(urlInput).toHaveAttribute('readOnly');
    
    // Check that the original URL is displayed (truncated if long)
    expect(screen.getByText(/Original URL:/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/www\.example\.com\/test-page/)).toBeInTheDocument();
  });

  test('displays copy button and handles copy functionality', async () => {
    render(<URLDisplay {...mockProps} />);
    
    const copyButton = screen.getByText('📋 Copy');
    expect(copyButton).toBeInTheDocument();
    
    // Click the copy button
    fireEvent.click(copyButton);
    
    // Wait for the clipboard write operation
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockProps.shortenedUrl);
    });
    
    // Check that the button text changes to show success
    await waitFor(() => {
      expect(screen.getByText('✓ Copied!')).toBeInTheDocument();
    });
    
    // Check that onCopySuccess callback is called
    expect(mockProps.onCopySuccess).toHaveBeenCalled();
  });

  test('displays and handles Test Link button for redirect testing', () => {
    render(<URLDisplay {...mockProps} />);
    
    // Find the Test Link button
    const testLinkButton = screen.getByText('🔗 Test Link');
    expect(testLinkButton).toBeInTheDocument();
    
    // Check that it's properly configured as a link
    expect(testLinkButton.tagName).toBe('A');
    expect(testLinkButton).toHaveAttribute('href', mockProps.shortenedUrl);
    expect(testLinkButton).toHaveAttribute('target', '_blank');
    expect(testLinkButton).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('truncates long original URLs in display', () => {
    const longUrlProps = {
      ...mockProps,
      originalUrl: 'https://www.example.com/very/long/path/that/should/be/truncated/because/it/exceeds/fifty/characters',
    };
    
    render(<URLDisplay {...longUrlProps} />);
    
    // Should show truncated version with ellipsis
    expect(screen.getByText(/https:\/\/www\.example\.com\/very\/long\/path\/that\/should\.\.\.$/)).toBeInTheDocument();
    
    // But the full URL should still be available in the title attribute
    const originalUrlSpan = screen.getByTitle(longUrlProps.originalUrl);
    expect(originalUrlSpan).toBeInTheDocument();
  });

  test('does not render when no shortened URL is provided', () => {
    const emptyProps = {
      ...mockProps,
      shortenedUrl: '',
    };
    
    const { container } = render(<URLDisplay {...emptyProps} />);
    expect(container.firstChild).toBeNull();
  });

  test('handles copy failure gracefully', async () => {
    // Mock clipboard to reject the promise
    const mockClipboard = {
      writeText: jest.fn(() => Promise.reject(new Error('Clipboard access denied'))),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    });

    // Mock console.error to avoid error output in tests
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<URLDisplay {...mockProps} />);
    
    const copyButton = screen.getByText('📋 Copy');
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy URL:', expect.any(Error));
    });
    
    // Button should not show success state
    expect(screen.queryByText('✓ Copied!')).not.toBeInTheDocument();
    expect(screen.getByText('📋 Copy')).toBeInTheDocument();
    
    consoleErrorSpy.mockRestore();
  });

  test('copy success state resets after timeout', async () => {
    jest.useFakeTimers();
    
    render(<URLDisplay {...mockProps} />);
    
    const copyButton = screen.getByText('📋 Copy');
    fireEvent.click(copyButton);
    
    // Should show success state initially
    await waitFor(() => {
      expect(screen.getByText('✓ Copied!')).toBeInTheDocument();
    });
    
    // Fast-forward time by 2 seconds
    jest.advanceTimersByTime(2000);
    
    // Should return to original state
    await waitFor(() => {
      expect(screen.getByText('📋 Copy')).toBeInTheDocument();
      expect(screen.queryByText('✓ Copied!')).not.toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  test('Test Link button has correct CSS classes for styling', () => {
    render(<URLDisplay {...mockProps} />);
    
    const testLinkButton = screen.getByText('🔗 Test Link');
    expect(testLinkButton).toHaveClass('btn', 'btn-accent', 'url-display__test-button');
  });

  test('copy button has correct CSS classes', () => {
    render(<URLDisplay {...mockProps} />);
    
    const copyButton = screen.getByText('📋 Copy');
    expect(copyButton).toHaveClass('btn', 'btn-primary', 'url-display__copy-button');
  });

  test('copy button classes change when in copied state', async () => {
    render(<URLDisplay {...mockProps} />);
    
    const copyButton = screen.getByText('📋 Copy');
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      const copiedButton = screen.getByText('✓ Copied!');
      expect(copiedButton).toHaveClass('btn', 'btn-accent', 'url-display__copy-button');
    });
  });

  test('URL input has correct CSS classes and attributes', () => {
    render(<URLDisplay {...mockProps} />);
    
    const urlInput = screen.getByDisplayValue(mockProps.shortenedUrl);
    expect(urlInput).toHaveClass('input', 'url-display__url-input');
    expect(urlInput).toHaveAttribute('type', 'text');
    expect(urlInput).toHaveAttribute('readOnly');
  });

  test('component applies fade-in animation class', () => {
    const { container } = render(<URLDisplay {...mockProps} />);
    
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('url-display', 'fade-in');
  });

  test('component shows success message', () => {
    render(<URLDisplay {...mockProps} />);
    
    expect(screen.getByText('Your shortened URL is ready!')).toBeInTheDocument();
  });

  test('handles different shortened URL formats', () => {
    const differentFormats = [
      'http://localhost:8080/shortened-url/abc123',
      'https://short.ly/def456', 
      'https://myapp.com/s/ghi789',
    ];
    
    differentFormats.forEach((shortenedUrl) => {
      const { rerender } = render(<URLDisplay {...mockProps} shortenedUrl={shortenedUrl} />);
      
      const urlInput = screen.getByDisplayValue(shortenedUrl);
      expect(urlInput).toBeInTheDocument();
      
      const testLinkButton = screen.getByText('🔗 Test Link');
      expect(testLinkButton).toHaveAttribute('href', shortenedUrl);
      
      rerender(<URLDisplay {...mockProps} shortenedUrl="" />);
    });
  });
});