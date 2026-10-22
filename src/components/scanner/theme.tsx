"use client";

import { useTheme } from "next-themes";
import type { ReactNode } from "react";

export function IsoFrame({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <div className="iso scan-loader" data-theme={resolvedTheme === "light" ? "light" : undefined} suppressHydrationWarning>
      {children}
    </div>
  );
}
