import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './providers/AuthProvider';
import { router } from './router';

// Create a query client with optimal caching and stale-time defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

import { WebPrivacyShield } from '@/components/common/WebPrivacyShield';

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebPrivacyShield>
          <RouterProvider router={router} />
        </WebPrivacyShield>
      </AuthProvider>
    </QueryClientProvider>
  );
};
