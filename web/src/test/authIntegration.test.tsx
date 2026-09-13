import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';

import { AuthContextType } from '@/types/auth';

// Mock the AuthContext hook
const mockLogin = vi.fn();
const mockRegister = vi.fn();
let mockAuthValue: AuthContextType = {
  user: null,
  status: 'UNAUTHENTICATED',
  error: null,
  login: mockLogin,
  register: mockRegister,
  updateUser: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: false,
  isInitializing: false,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthValue,
}));

describe('Auth UI Components and Protected Routes', () => {
  it('LoginPage renders email and password fields and handles empty submit', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    // Should render validation banner without calling login
    expect(await screen.findByText(/please enter both email and password/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('RegisterPage validates password length and confirmation match', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);
    const submitBtn = screen.getByRole('button', { name: /create free account/i });

    // Test short password
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.change(confirmInput, { target: { value: 'short' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/must be at least 10 characters/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();

    // Test password mismatch
    fireEvent.change(passwordInput, { target: { value: 'ValidPassword123!' } });
    fireEvent.change(confirmInput, { target: { value: 'MismatchedPassword123!' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('ProtectedRoute redirects unauthenticated users to /login', () => {
    mockAuthValue = {
      ...mockAuthValue,
      isAuthenticated: false,
      isInitializing: false,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Secret Dashboard Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page Target')).toBeInTheDocument();
  });

  it('ProtectedRoute renders protected content when authenticated', () => {
    mockAuthValue = {
      ...mockAuthValue,
      isAuthenticated: true,
      isInitializing: false,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Secret Dashboard Content')).toBeInTheDocument();
  });
});
