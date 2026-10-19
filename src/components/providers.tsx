"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";

type ProvidersProps = {
  children: React.ReactNode;
  userEmail?: string;
};

export function Providers({ children, userEmail }: ProvidersProps) {
  useEffect(() => {
    if (userEmail) {
      // The email gate has no immutable user record, so email is its only stable identifier.
      posthog.identify(userEmail, { email: userEmail });
    }
  }, [userEmail]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
