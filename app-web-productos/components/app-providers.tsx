"use client";

import { ToastProvider } from "./toast-provider";
import NavigationProgress from "./navigation-progress";
import PwaRegistrar from "./pwa-registrar";
import ThemeProvider from "./theme-provider";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <NavigationProgress />
        <PwaRegistrar />
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
