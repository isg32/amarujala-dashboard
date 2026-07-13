"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import Link from "next/link";

// Better Auth's client refetches the session on every browser tab
// focus/visibility change by default (see better-auth's session-refresh.mjs:
// refetchOnWindowFocus defaults to true). Each refetch fires onSessionChange
// below, which without a guard calls router.refresh() every time — in dev
// this reruns every Server Component on the current route on each tab
// focus, which is what was showing up as repeated "GET /dashboard" spam and
// loading.tsx flicker. The debounce keeps the refresh-after-real-sign-in/out
// behavior (still fires immediately on the first change) while collapsing
// a burst of focus-triggered refetches into one.
const REFRESH_DEBOUNCE_MS = 2000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        const now = Date.now();
        if (now - lastRefresh.current < REFRESH_DEBOUNCE_MS) return;
        lastRefresh.current = now;
        router.refresh();
      }}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
