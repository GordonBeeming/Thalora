import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthContext } from '../../utils/AuthContext';
import Login from '../Login';

// Mock the auth service
jest.mock('../../services/auth', () => ({
  loginWithPasskey: jest.fn(),
}));

const mockAuthService = require('../../services/auth');

const mockAuthContextValue = {
  user: null,
  login: jest.fn(),
  logout: jest.fn(),
  isLoading: false,
};

const renderWithAuthContext = (component: React.ReactElement) => {
  return render(
    <AuthContext.Provider value={mockAuthContextValue}>
      {component}
    </AuthContext.Provider>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form', () => {
    renderWithAuthContext(<Login />);
    
    expect(screen.getByText('Login with Passkey')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument();
  });

  test('displays validation error for empty username', async () => {
    renderWithAuthContext(<Login />);
    
    const signInButton = screen.getByRole('button', { name: /sign in with passkey/i });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter your username')).toBeInTheDocument();
    });
  });

  test('calls loginWithPasskey on form submission', async () => {
    mockAuthService.loginWithPasskey.mockResolvedValue({
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com'
    });

    renderWithAuthContext(<Login />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const signInButton = screen.getByRole('button', { name: /sign in with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockAuthService.loginWithPasskey).toHaveBeenCalledWith('testuser');
    });
  });

  test('displays error message on login failure', async () => {
    mockAuthService.loginWithPasskey.mockRejectedValue(new Error('Login failed'));

    renderWithAuthContext(<Login />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const signInButton = screen.getByRole('button', { name: /sign in with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  test('shows loading state during login', async () => {
    let resolveLogin: (value: any) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    mockAuthService.loginWithPasskey.mockReturnValue(loginPromise);

    renderWithAuthContext(<Login />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const signInButton = screen.getByRole('button', { name: /sign in with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.click(signInButton);

    // Check loading state
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(signInButton).toBeDisabled();

    // Resolve the promise
    resolveLogin!({
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com'
    });

    await waitFor(() => {
      expect(screen.queryByText('Signing in...')).not.toBeInTheDocument();
    });
  });

  test('handles WebAuthn not supported error', async () => {
    mockAuthService.loginWithPasskey.mockRejectedValue(new Error('WebAuthn is not supported in this browser'));

    renderWithAuthContext(<Login />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const signInButton = screen.getByRole('button', { name: /sign in with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText('WebAuthn is not supported in this browser')).toBeInTheDocument();
    });
  });
});