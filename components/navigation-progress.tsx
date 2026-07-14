"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef(pathname + "?" + searchParams);

  useEffect(() => {
    const current = pathname + "?" + searchParams;
    if (current !== prevRef.current) {
      prevRef.current = current;
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 z-[100] h-[3px] w-full">
      <div className="h-full w-1/2 animate-progress bg-primary" />
    </div>
  );
}
