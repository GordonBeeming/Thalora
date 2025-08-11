import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthContext } from '../../utils/AuthContext';
import Register from '../Register';

// Mock the auth service
jest.mock('../../services/auth', () => ({
  registerWithPasskey: jest.fn(),
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

describe('Register Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders registration form', () => {
    renderWithAuthContext(<Register />);
    
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account with passkey/i })).toBeInTheDocument();
  });

  test('displays validation errors for empty fields', async () => {
    renderWithAuthContext(<Register />);
    
    const createButton = screen.getByRole('button', { name: /create account with passkey/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a username')).toBeInTheDocument();
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    });
  });

  test('validates email format', async () => {
    renderWithAuthContext(<Register />);
    
    const emailInput = screen.getByPlaceholderText('Email');
    const createButton = screen.getByRole('button', { name: /create account with passkey/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    });
  });

  test('calls registerWithPasskey on form submission', async () => {
    mockAuthService.registerWithPasskey.mockResolvedValue({
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com'
    });

    renderWithAuthContext(<Register />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const emailInput = screen.getByPlaceholderText('Email');
    const createButton = screen.getByRole('button', { name: /create account with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAuthService.registerWithPasskey).toHaveBeenCalledWith('testuser', 'test@example.com');
    });
  });

  test('displays error message on registration failure', async () => {
    mockAuthService.registerWithPasskey.mockRejectedValue(new Error('Registration failed'));

    renderWithAuthContext(<Register />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const emailInput = screen.getByPlaceholderText('Email');
    const createButton = screen.getByRole('button', { name: /create account with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument();
    });
  });

  test('shows loading state during registration', async () => {
    let resolveRegistration: (value: any) => void;
    const registrationPromise = new Promise((resolve) => {
      resolveRegistration = resolve;
    });
    mockAuthService.registerWithPasskey.mockReturnValue(registrationPromise);

    renderWithAuthContext(<Register />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const emailInput = screen.getByPlaceholderText('Email');
    const createButton = screen.getByRole('button', { name: /create account with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(createButton);

    // Check loading state
    expect(screen.getByText('Creating account...')).toBeInTheDocument();
    expect(createButton).toBeDisabled();

    // Resolve the promise
    resolveRegistration!({
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com'
    });

    await waitFor(() => {
      expect(screen.queryByText('Creating account...')).not.toBeInTheDocument();
    });
  });

  test('handles username already exists error', async () => {
    mockAuthService.registerWithPasskey.mockRejectedValue(new Error('Username already exists'));

    renderWithAuthContext(<Register />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const emailInput = screen.getByPlaceholderText('Email');
    const createButton = screen.getByRole('button', { name: /create account with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'existinguser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });
  });

  test('handles email already exists error', async () => {
    mockAuthService.registerWithPasskey.mockRejectedValue(new Error('Email already exists'));

    renderWithAuthContext(<Register />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const emailInput = screen.getByPlaceholderText('Email');
    const createButton = screen.getByRole('button', { name: /create account with passkey/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });
});