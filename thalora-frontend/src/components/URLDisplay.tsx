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

  if (!shortenedUrl) {
    return null;
  }

  return (
    <div className="url-display fade-in">
      <div className="url-display__header">
        <h3 className="url-display__title">Your shortened URL is ready!</h3>
      </div>
      
      <div className="url-display__content">
        <div className="url-display__result">
          <div className="url-display__url-container">
            <input
              type="text"
              className="input url-display__url-input"
              value={shortenedUrl}
              readOnly
            />
            <button
              className={`btn ${copied ? 'btn-accent' : 'btn-primary'} url-display__copy-button`}
              onClick={handleCopy}
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
        </div>
        
        <div className="url-display__original">
          <span className="url-display__original-label">Original URL:</span>
          <span className="url-display__original-url" title={originalUrl}>
            {originalUrl.length > 50 ? `${originalUrl.substring(0, 50)}...` : originalUrl}
          </span>
        </div>
      </div>
      
      <div className="url-display__actions">
        <a
          href={shortenedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-accent url-display__test-button"
        >
          🔗 Test Link
        </a>
      </div>
    </div>
  );
};

export default URLDisplay;