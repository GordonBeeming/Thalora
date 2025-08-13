import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import URLDisplay from '../URLDisplay';

// Simple integration test focused on redirect functionality
describe('Redirect Testing Integration', () => {
  const mockProps = {
    originalUrl: 'https://www.example.com/test-page',
    shortenedUrl: 'http://localhost:8080/shortened-url/abc123',
  };

  beforeEach(() => {
    // Mock clipboard API for the copy functionality
    if (!navigator.clipboard) {
      const mockClipboard = {
        writeText: jest.fn(() => Promise.resolve()),
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });
    } else {
      navigator.clipboard.writeText = jest.fn(() => Promise.resolve());
    }
  });

  test('URLDisplay component correctly sets up Test Link for redirect testing', () => {
    render(<URLDisplay {...mockProps} />);

    // Verify the Test Link button is properly configured for redirect testing
    const testLinkButton = screen.getByText('🔗 Test Link');
    expect(testLinkButton).toBeInTheDocument();

    // Critical assertions for redirect functionality
    expect(testLinkButton.tagName).toBe('A');
    expect(testLinkButton).toHaveAttribute('href', 'http://localhost:8080/shortened-url/abc123');
    expect(testLinkButton).toHaveAttribute('target', '_blank');
    expect(testLinkButton).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify the shortened URL format matches backend endpoint structure
    const href = testLinkButton.getAttribute('href');
    expect(href).toMatch(/\/shortened-url\/[a-zA-Z0-9]+$/);
  });

  test('Test Link button works with different shortened URL formats', () => {
    const testCases = [
      {
        originalUrl: 'https://www.gordonbeeming.com',
        shortenedUrl: 'http://localhost:8080/shortened-url/google123',
      },
      {
        originalUrl: 'https://github.com/user/repo',
        shortenedUrl: 'https://short.ly/shortened-url/git456',
      },
      {
        originalUrl: 'https://example.com/long/path/with/parameters?key=value',
        shortenedUrl: 'https://myapp.com/shortened-url/xyz789',
      },
    ];

    testCases.forEach(({ originalUrl, shortenedUrl }) => {
      const { rerender } = render(<URLDisplay originalUrl={originalUrl} shortenedUrl={shortenedUrl} />);

      const testLinkButton = screen.getByText('🔗 Test Link');
      expect(testLinkButton).toHaveAttribute('href', shortenedUrl);

      // Clean up for next iteration
      rerender(<URLDisplay originalUrl="" shortenedUrl="" />);
    });
  });

  test('shortened URL follows expected backend endpoint pattern', () => {
    render(<URLDisplay {...mockProps} />);

    const urlInput = screen.getByDisplayValue(mockProps.shortenedUrl);
    const displayedUrl = urlInput.value;

    // Verify the URL structure matches our backend endpoint pattern
    expect(displayedUrl).toMatch(/^https?:\/\/.+\/shortened-url\/[a-zA-Z0-9]+$/);

    // Extract the short ID from the URL
    const shortIdMatch = displayedUrl.match(/\/shortened-url\/([a-zA-Z0-9]+)$/);
    expect(shortIdMatch).toBeTruthy();

    const shortId = shortIdMatch?.[1];
    expect(shortId).toBeTruthy();
    expect(shortId?.length).toBeGreaterThan(0);
  });

  test('copy functionality works with shortened URLs for sharing', async () => {
    render(<URLDisplay {...mockProps} />);

    const copyButton = screen.getByText('📋 Copy');
    copyButton.click();

    // Verify the shortened URL is copied to clipboard for sharing
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockProps.shortenedUrl);
  });

  test('component displays all necessary elements for redirect testing workflow', () => {
    render(<URLDisplay {...mockProps} />);

    // Verify all elements needed for the complete redirect testing workflow

    // 1. Shortened URL display (for copying/sharing)
    const urlInput = screen.getByDisplayValue(mockProps.shortenedUrl);
    expect(urlInput).toBeInTheDocument();
    expect(urlInput).toHaveAttribute('readOnly');

    // 2. Copy button (for sharing the shortened URL)
    const copyButton = screen.getByText('📋 Copy');
    expect(copyButton).toBeInTheDocument();

    // 3. Test Link button (for testing the redirect)
    const testLinkButton = screen.getByText('🔗 Test Link');
    expect(testLinkButton).toBeInTheDocument();

    // 4. Original URL reference (for verification)
    expect(screen.getByText(/original url:/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockProps.originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();

    // 5. Success message
    expect(screen.getByText('Your shortened URL is ready!')).toBeInTheDocument();
  });

  test('Test Link configuration is secure (noopener noreferrer)', () => {
    render(<URLDisplay {...mockProps} />);

    const testLinkButton = screen.getByText('🔗 Test Link');

    // Security check: ensure the link opens safely
    expect(testLinkButton).toHaveAttribute('rel', 'noopener noreferrer');
    expect(testLinkButton).toHaveAttribute('target', '_blank');

    // This prevents the new page from accessing the parent window object
    // which is important when testing redirects to external sites
  });
});