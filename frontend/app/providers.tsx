"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTokenRefresh } from "./hooks/useTokenRefresh";

const PUBLIC_ROUTES = ["/", "/login", "/register"];

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

  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  return (
    <QueryClientProvider client={queryClient}>
      {!isPublic && <TokenRefreshRunner />}
      {children}
    </QueryClientProvider>
  );
}
