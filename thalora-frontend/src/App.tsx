import React from 'react';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Home from './pages/Home';
import AuthPage from './pages/AuthPage';
import './styles/globals.css';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading fade-in">
        <div className="app-loading__spinner"></div>
        <p className="app-loading__text">Loading...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {isAuthenticated ? <Home /> : <AuthPage />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;