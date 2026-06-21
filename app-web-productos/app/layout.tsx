import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "../components/app-header";
import AppProviders from "../components/app-providers";

export const metadata: Metadata = {
  title: "AhorraPe",
  description: "Buscador de productos cercanos con mapa y reservas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <AppProviders>
          <AppHeader />
          <main className="pt-16">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
