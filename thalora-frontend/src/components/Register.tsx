import React, { useState, useEffect } from 'react';
import { registerWithPasskey, isWebAuthnSupported, isTestMode } from '../services/auth';
import './Register.css';

interface RegisterProps {
  onRegisterSuccess: (username: string) => void;
  onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [testMode, setTestMode] = useState<boolean>(false);

  useEffect(() => {
    // Check if test mode is enabled
    isTestMode().then(setTestMode);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    const { username, email } = formData;
    
    if (!username.trim()) {
      setError('Username is required');
      return false;
    }
    
    if (username.length < 3 || username.length > 255) {
      setError('Username must be between 3 and 255 characters');
      return false;
    }
    
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Skip WebAuthn check in test mode
    if (!testMode && !isWebAuthnSupported()) {
      setError('Passkey authentication is not supported in this browser. Please use a modern browser with WebAuthn support.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { username, email } = formData;
      const response = await registerWithPasskey(username.trim(), email.trim());
      console.log('Registration successful:', response);
      onRegisterSuccess(response.username);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = formData.username.trim() && formData.email.trim();

  return (
    <div className="register">
      <div className="register__container">
        <div className="register__header">
          <h1 className="register__title">Create Account</h1>
          <p className="register__subtitle">Set up your account with passkey authentication</p>
        </div>

        <form className="register__form" onSubmit={handleSubmit}>
          <div className="register__field">
            <label className="register__label" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="register__input"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Choose a username"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="register__input"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="register__error">
              <span className="register__error-icon">⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="register__submit"
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? (
              <>
                <div className="register__loading-spinner"></div>
                Creating Account...
              </>
            ) : (
              <>
                <span className="register__submit-icon">🔐</span>
                Create Account with Passkey
              </>
            )}
          </button>
        </form>

        <div className="register__info">
          <div className="register__info-item">
            <span className="register__info-icon">🔒</span>
            <p>Your passkey is stored securely on your device</p>
          </div>
          <div className="register__info-item">
            <span className="register__info-icon">✋</span>
            <p>Use biometrics or PIN to authenticate</p>
          </div>
          <div className="register__info-item">
            <span className="register__info-icon">🚀</span>
            <p>No passwords to remember</p>
          </div>
        </div>

        <div className="register__footer">
          <p className="register__switch">
            Already have an account?{' '}
            <button
              type="button"
              className="register__switch-button"
              onClick={onSwitchToLogin}
              disabled={isLoading}
            >
              Sign in
            </button>
          </p>
        </div>

        {!isWebAuthnSupported() && (
          <div className="register__warning">
            <span className="register__warning-icon">⚠️</span>
            <p>
              Your browser doesn't support passkey authentication. 
              Please use a modern browser like Chrome, Firefox, Safari, or Edge.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;