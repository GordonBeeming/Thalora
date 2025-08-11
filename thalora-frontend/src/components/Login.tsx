import React, { useState } from 'react';
import { loginWithPasskey, isWebAuthnSupported } from '../services/auth';
import './Login.css';

interface LoginProps {
  onLoginSuccess: (username: string) => void;
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!isWebAuthnSupported()) {
      setError('Passkey authentication is not supported in this browser. Please use a modern browser with WebAuthn support.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await loginWithPasskey(username.trim());
      console.log('Login successful:', response);
      onLoginSuccess(response.username);
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login__container">
        <div className="login__header">
          <h1 className="login__title">Welcome Back</h1>
          <p className="login__subtitle">Sign in with your passkey</p>
        </div>

        <form className="login__form" onSubmit={handleSubmit}>
          <div className="login__field">
            <label className="login__label" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="login__input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={isLoading}
              autoComplete="username webauthn"
            />
          </div>

          {error && (
            <div className="login__error">
              <span className="login__error-icon">⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login__submit"
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? (
              <>
                <div className="login__loading-spinner"></div>
                Authenticating...
              </>
            ) : (
              <>
                <span className="login__submit-icon">🔐</span>
                Sign in with Passkey
              </>
            )}
          </button>
        </form>

        <div className="login__footer">
          <p className="login__switch">
            Don't have an account?{' '}
            <button
              type="button"
              className="login__switch-button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
            >
              Create one
            </button>
          </p>
        </div>

        {!isWebAuthnSupported() && (
          <div className="login__warning">
            <span className="login__warning-icon">⚠️</span>
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

export default Login;