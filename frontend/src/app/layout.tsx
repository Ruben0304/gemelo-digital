import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Gemelo Digital · Microrred Solar Fotovoltaica",
    template: "%s · Gemelo Digital",
  },
  description:
    "Monitoreo, predicción y análisis de una microrred solar fotovoltaica de 50 kW con almacenamiento de 100 kWh en La Habana, Cuba.",
  applicationName: "Gemelo Digital Fotovoltaico",
  keywords: ["gemelo digital", "energía fotovoltaica", "microrred solar", "CUJAE"],
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
      >
        {children}
      </body>
    </html>
  );
}
