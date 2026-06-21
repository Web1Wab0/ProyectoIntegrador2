"use client";

import { ToastProvider } from "./toast-provider";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
