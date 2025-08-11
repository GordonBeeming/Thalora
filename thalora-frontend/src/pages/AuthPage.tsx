import React, { useState } from 'react';
import Login from '../components/Login';
import Register from '../components/Register';
import { useAuth } from '../utils/AuthContext';
import './AuthPage.css';

const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { login } = useAuth();

  const handleLoginSuccess = (username: string) => {
    console.log('Login successful for:', username);
    login(username);
  };

  const handleRegisterSuccess = (username: string) => {
    console.log('Registration successful for:', username);
    login(username);
  };

  const handleSwitchToRegister = () => {
    setActiveTab('register');
  };

  const handleSwitchToLogin = () => {
    setActiveTab('login');
  };

  return (
    <div className="auth-page">
      <div className="auth-page__background">
        <div className="auth-page__shapes">
          <div className="auth-page__shape auth-page__shape--1"></div>
          <div className="auth-page__shape auth-page__shape--2"></div>
          <div className="auth-page__shape auth-page__shape--3"></div>
        </div>
      </div>
      
      <div className="auth-page__content">
        <div className="auth-page__header">
          <div className="auth-page__logo">
            <span className="auth-page__logo-icon">🔗</span>
            <h1 className="auth-page__logo-text">Thalora</h1>
          </div>
          <p className="auth-page__tagline">
            Secure URL shortening with passkey authentication
          </p>
        </div>

        {activeTab === 'login' ? (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={handleSwitchToRegister}
          />
        ) : (
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={handleSwitchToLogin}
          />
        )}
      </div>
    </div>
  );
};

export default AuthPage;