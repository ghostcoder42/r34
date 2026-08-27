import { useReactQueryDevTools } from '@dev-plugins/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as React from 'react';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data on remount within this window instead of re-scraping
      // every visit. Pull-to-refresh still forces a refetch.
      staleTime: 5 * 60 * 1000,
    },
  },
});

export function APIProvider({ children }: { children: React.ReactNode }) {
  useReactQueryDevTools(queryClient);
  return (
    // Provide the client to your App
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
