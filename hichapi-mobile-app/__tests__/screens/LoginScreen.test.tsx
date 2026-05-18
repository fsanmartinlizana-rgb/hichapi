/**
 * Component tests for LoginScreen.
 * Verifies form validation, submission, error display, and navigation.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import LoginScreen from '../../screens/auth/LoginScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogin = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    session: null,
    loading: false,
    logout: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// Minimal navigation prop passed directly to the screen
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as any;

const mockRoute = {} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLoginScreen() {
  return render(<LoginScreen navigation={mockNavigation} route={mockRoute} />);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Renders correctly
// ---------------------------------------------------------------------------

describe('LoginScreen — renders correctly', () => {
  it('renders the HiChapi title', () => {
    const { getByText } = renderLoginScreen();
    expect(getByText('HiChapi')).toBeTruthy();
  });

  it('renders the email input field', () => {
    const { getByPlaceholderText } = renderLoginScreen();
    expect(getByPlaceholderText('tu@correo.com')).toBeTruthy();
  });

  it('renders the password input field', () => {
    const { getByPlaceholderText } = renderLoginScreen();
    expect(getByPlaceholderText('Mínimo 6 caracteres')).toBeTruthy();
  });

  it('renders the "Iniciar sesión" button', () => {
    const { getByText } = renderLoginScreen();
    expect(getByText('Iniciar sesión')).toBeTruthy();
  });

  it('renders the "¿Olvidaste tu contraseña?" link', () => {
    const { getByText } = renderLoginScreen();
    expect(getByText('¿Olvidaste tu contraseña?')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. Form validation
// ---------------------------------------------------------------------------

describe('LoginScreen — form validation', () => {
  it('shows email error when submitting with empty email', async () => {
    const { getByText } = renderLoginScreen();
    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });
    expect(getByText('El correo es requerido')).toBeTruthy();
  });

  it('shows password error when submitting with empty password', async () => {
    const { getByText, getByPlaceholderText } = renderLoginScreen();
    fireEvent.changeText(getByPlaceholderText('tu@correo.com'), 'user@example.com');
    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });
    expect(getByText('La contraseña es requerida')).toBeTruthy();
  });

  it('shows email format error when email is invalid', async () => {
    const { getByText, getByPlaceholderText } = renderLoginScreen();
    fireEvent.changeText(getByPlaceholderText('tu@correo.com'), 'notanemail');
    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });
    expect(getByText('Ingresa un correo válido')).toBeTruthy();
  });

  it('shows password length error when password is less than 6 chars', async () => {
    const { getByText, getByPlaceholderText } = renderLoginScreen();
    fireEvent.changeText(getByPlaceholderText('tu@correo.com'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123');
    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });
    expect(getByText('La contraseña debe tener al menos 6 caracteres')).toBeTruthy();
  });

  it('does NOT call login when form is invalid', async () => {
    const { getByText } = renderLoginScreen();
    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Successful submission
// ---------------------------------------------------------------------------

describe('LoginScreen — successful submission', () => {
  it('calls login with trimmed lowercase email and password when form is valid', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const { getByText, getByPlaceholderText } = renderLoginScreen();

    fireEvent.changeText(getByPlaceholderText('tu@correo.com'), '  User@Example.com  ');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'password123');

    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });

    expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
  });
});

// ---------------------------------------------------------------------------
// 4. Error display
// ---------------------------------------------------------------------------

describe('LoginScreen — error display', () => {
  it('shows "Correo o contraseña incorrectos" when login throws Invalid login credentials', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid login credentials'));
    const { getByText, getByPlaceholderText } = renderLoginScreen();

    fireEvent.changeText(getByPlaceholderText('tu@correo.com'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'wrongpass');

    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });

    await waitFor(() => {
      expect(getByText('Correo o contraseña incorrectos')).toBeTruthy();
    });
  });

  it('shows generic error message when login throws an unknown error', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network timeout'));
    const { getByText, getByPlaceholderText } = renderLoginScreen();

    fireEvent.changeText(getByPlaceholderText('tu@correo.com'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'password123');

    await act(async () => {
      fireEvent.press(getByText('Iniciar sesión'));
    });

    await waitFor(() => {
      expect(getByText('No se pudo iniciar sesión. Intenta nuevamente.')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Navigation
// ---------------------------------------------------------------------------

describe('LoginScreen — navigation', () => {
  it('navigates to PasswordRecovery when "¿Olvidaste tu contraseña?" is pressed', () => {
    const { getByText } = renderLoginScreen();
    fireEvent.press(getByText('¿Olvidaste tu contraseña?'));
    expect(mockNavigate).toHaveBeenCalledWith('PasswordRecovery');
  });
});
