import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "../components/app-header";

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
      <body className="bg-gray-950 text-white">
        <AppHeader />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
