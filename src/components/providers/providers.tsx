"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ImpersonationBanner } from "@/components/auth/impersonation-banner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MockGate } from "./mock-gate";
import { QueryProvider } from "./query-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        <MockGate>
          <QueryProvider>
            <AuthProvider>
              <ImpersonationBanner />
              {children}
            </AuthProvider>
          </QueryProvider>
        </MockGate>
        <Toaster position="bottom-right" closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
