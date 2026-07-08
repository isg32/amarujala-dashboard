"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@neondatabase/auth/react/ui";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration mismatch: resolvedTheme is only known once mounted
  // client-side (next-themes reads the persisted/OS preference after the
  // initial SSR render).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes' own documented pattern for this exact hydration guard.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      {mounted ? (isDark ? "Light" : "Dark") : ""}
    </button>
  );
}
