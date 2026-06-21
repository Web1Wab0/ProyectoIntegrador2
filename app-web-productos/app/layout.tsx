import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "../components/app-header";
import AppProviders from "../components/app-providers";
import AppFooter from "../components/app-footer";

export const metadata: Metadata = {
  title: "AhorraPe",
  description: "Buscador de productos cercanos con mapa y reservas",
  applicationName: "AhorraPe",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AhorraPe",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('ahorrape-theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})();`,
          }}
        />
        <meta name="theme-color" content="#7900f3" />
      </head>
      <body>
        <AppProviders>
          <AppHeader />
          <main className="pt-16">{children}</main>
          <AppFooter />
        </AppProviders>
      </body>
    </html>
  );
}
