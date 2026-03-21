"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useTokenRefresh } from "./hooks/useTokenRefresh";

function TokenRefreshRunner() {
  useTokenRefresh();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 10_000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TokenRefreshRunner />
      {children}
    </QueryClientProvider>
  );
}
