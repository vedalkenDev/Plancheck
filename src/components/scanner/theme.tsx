"use client";

import { useTheme } from "next-themes";
import type { ReactNode } from "react";

export function IsoFrame({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <div
      className="iso scan-loader"
      data-theme={resolvedTheme === "light" ? "light" : undefined}
      data-compact={compact ? "" : undefined}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
