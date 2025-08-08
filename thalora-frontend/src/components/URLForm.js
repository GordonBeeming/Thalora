import React, { useState } from 'react';
import { validateURL, normalizeURL } from '../utils/validateURL';
import './URLForm.css';

const URLForm = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a URL to shorten');
      return;
    }

    const normalizedUrl = normalizeURL(url);
    
    if (!validateURL(normalizedUrl)) {
      setError('Please enter a valid URL (e.g., google.com or https://google.com)');
      return;
    }

    onSubmit(normalizedUrl);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setUrl(value);
    if (error) {
      setError('');
    }
  };

  return (
    <div className="url-form">
      <form onSubmit={handleSubmit} className="url-form__form">
        <div className="url-form__input-group">
          <input
            type="text"
            className={`input url-form__input ${error ? 'error' : ''}`}
            placeholder="Enter your URL here (e.g., google.com)"
            value={url}
            onChange={handleInputChange}
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary url-form__button"
            disabled={isLoading || !url.trim()}
          >
            {isLoading ? 'Shortening...' : 'Shorten URL'}
          </button>
        </div>
        {error && (
          <div className="error-message slide-in">
            <span>⚠️</span>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default URLForm;