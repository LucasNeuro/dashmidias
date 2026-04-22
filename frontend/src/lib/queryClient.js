import { QueryClient } from '@tanstack/react-query';

/** Cliente partilhado para dados remotos (Supabase, APIs). Ajuste staleTime por query. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
