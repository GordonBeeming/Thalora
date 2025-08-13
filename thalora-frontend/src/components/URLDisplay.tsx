import React, { useState } from 'react';
import './URLDisplay.css';

interface URLDisplayProps {
  originalUrl: string;
  shortenedUrl: string;
  onCopySuccess?: () => void;
}

const URLDisplay: React.FC<URLDisplayProps> = ({ originalUrl, shortenedUrl, onCopySuccess }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortenedUrl);
      setCopied(true);
      if (onCopySuccess) {
        onCopySuccess();
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleSelectAll = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  if (!shortenedUrl) {
    return null;
  }

  return (
    <div className="url-display fade-in card interactive" role="region" aria-label="Shortened URL result">
      <div className="url-display__header">
        <h3 className="url-display__title">
          <span className="url-display__success-icon" aria-hidden="true">✨</span>
          Your shortened URL is ready!
        </h3>
      </div>
      
      <div className="url-display__content">
        <div className="url-display__result">
          <div className="url-display__url-container">
            <label htmlFor="shortened-url" className="sr-only">
              Shortened URL
            </label>
            <input
              id="shortened-url"
              type="text"
              className="input url-display__url-input"
              value={shortenedUrl}
              readOnly
              onClick={handleSelectAll}
              aria-label="Your shortened URL - click to select all"
            />
            <button
              className={`btn ${copied ? 'btn-accent' : 'btn-primary'} url-display__copy-button interactive`}
              onClick={handleCopy}
              aria-label={copied ? 'URL copied to clipboard' : 'Copy URL to clipboard'}
            >
              <span className="url-display__copy-icon" aria-hidden="true">
                {copied ? '✓' : '📋'}
              </span>
              <span className="url-display__copy-text">
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </button>
          </div>
        </div>
        
        <div className="url-display__original">
          <span className="url-display__original-label">Original URL:</span>
          <span 
            className="url-display__original-url" 
            title={originalUrl}
            aria-label={`Original URL: ${originalUrl}`}
          >
            {originalUrl.length > 50 ? `${originalUrl.substring(0, 50)}...` : originalUrl}
          </span>
        </div>
      </div>
      
      <div className="url-display__actions">
        <a
          href={shortenedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary url-display__test-button interactive"
          aria-label="Test the shortened link in a new tab"
        >
          <span aria-hidden="true">🔗</span>
          Test Link
        </a>
      </div>
    </div>
  );
};

export default URLDisplay;