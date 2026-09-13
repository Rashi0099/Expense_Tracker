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
  loginWithPhone: vi.fn(),
  updateUser: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: false,
  isInitializing: false,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthValue,
}));

describe('Auth UI Components and Protected Routes', () => {
  it('LoginPage renders mobile phone input and validates empty submit', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Mobile Number')).toBeInTheDocument();
    const sendBtn = screen.getByRole('button', { name: /send otp code/i });
    expect(sendBtn).toBeInTheDocument();

    fireEvent.click(sendBtn);
    expect(await screen.findByText(/please enter your mobile phone number/i)).toBeInTheDocument();
  });

  it('RegisterPage renders redirect to login', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>Login Page Redirected</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/login page redirected/i)).toBeInTheDocument();
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
