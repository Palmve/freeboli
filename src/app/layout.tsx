import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";

export const metadata: Metadata = {
  title: "FreeBoli - Puntos, BOLIS y Juegos",
  description: "Gana puntos gratis, juega y retira en BOLIS (Solana). Faucet, HI-LO y programa de afiliados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <Providers>
          <AnalyticsTracker />
          <Header />
          <main className="container mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
