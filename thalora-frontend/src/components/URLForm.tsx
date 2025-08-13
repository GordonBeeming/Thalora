import React, { useState } from 'react';
import { validateURL, normalizeURL } from '../utils/validateURL';
import './URLForm.css';

interface URLFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

const URLForm: React.FC<URLFormProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a URL to shorten');
      return;
    }

    const normalizedUrl = normalizeURL(url);
    
    if (!validateURL(normalizedUrl)) {
      setError('Please enter a valid HTTPS URL. HTTP URLs are not supported for security reasons.');
      return;
    }

    onSubmit(normalizedUrl);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    if (error) {
      setError('');
    }
  };

  return (
    <div className="url-form fade-in">
      <form onSubmit={handleSubmit} className="url-form__form">
        <div className="url-form__input-group">
          <div className="url-form__input-wrapper">
            <input
              type="text"
              className={`input url-form__input ${error ? 'error' : ''}`}
              placeholder="Enter your URL here (e.g., https://google.com)"
              value={url}
              onChange={handleInputChange}
              disabled={isLoading}
              autoFocus
              aria-describedby={error ? 'url-error' : undefined}
              aria-invalid={!!error}
            />
            <div className="url-form__input-icon">
              <span>🔗</span>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary url-form__button interactive"
            disabled={isLoading || !url.trim()}
            aria-label={isLoading ? 'Shortening URL...' : 'Shorten URL'}
          >
            <span className="url-form__button-text">
              {isLoading ? 'Shortening...' : 'Shorten URL'}
            </span>
            {isLoading && <div className="url-form__loading-spinner"></div>}
          </button>
        </div>
        {error && (
          <div className="error-message slide-in" id="url-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default URLForm;