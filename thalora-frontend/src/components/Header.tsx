import React from 'react';
import { useAuth } from '../utils/AuthContext';
import ThemeToggle from './ThemeToggle';
import './Header.css';

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header__content">
          <div className="header__logo scale-in">
            <h1 className="header__title">
              <span className="header__title-main">Thalora</span>
              <span className="header__title-sub">URL Shortener</span>
            </h1>
          </div>
          <div className="header__description fade-in">
            <p className="header__tagline">
              Modern, secure, and customizable URL shortening
            </p>
          </div>
          <div className="header__controls">
            <ThemeToggle />
            {user && (
              <div className="header__user slide-in-right">
                <div className="header__user-info">
                  <span className="header__user-icon">👤</span>
                  <span className="header__username">{user.username}</span>
                </div>
                <button 
                  className="header__logout" 
                  onClick={handleLogout}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <span className="header__logout-icon">🚪</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;