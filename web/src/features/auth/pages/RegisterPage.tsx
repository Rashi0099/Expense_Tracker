import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Since authentication is now exclusively Phone Number + OTP,
 * Registration and Login are unified. Redirect to /login.
 */
export const RegisterPage: React.FC = () => {
  return <Navigate to="/login" replace />;
};
