import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { ExpensesPage } from '@/features/expenses/pages/ExpensesPage';
import { IncomePage } from '@/features/income/pages/IncomePage';
import { BudgetsPage } from '@/features/budgets/pages/BudgetsPage';
import { CategoriesPage } from '@/features/categories/pages/CategoriesPage';
import { RecurringPage } from '@/features/recurring/pages/RecurringPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { PublicOnlyRoute } from '@/components/common/PublicOnlyRoute';

export const router = createBrowserRouter([
  // Public Routes (Redirect to dashboard if already logged in)
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnlyRoute>
        <RegisterPage />
      </PublicOnlyRoute>
    ),
  },

  // Authenticated App Layout Routes (Redirect to /login if unauthenticated)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'expenses',
        element: <ExpensesPage />,
      },
      {
        path: 'income',
        element: <IncomePage />,
      },
      {
        path: 'budgets',
        element: <BudgetsPage />,
      },
      {
        path: 'categories',
        element: <CategoriesPage />,
      },
      {
        path: 'recurring',
        element: <RecurringPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },

  // Fallback 404 Route
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
