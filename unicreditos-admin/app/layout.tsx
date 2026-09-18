import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UNICRÉDITOS · Backoffice",
  description:
    "Administrador de crédito personal y consumo — Argentina. Originación, tesorería, KYC Didit y cobranzas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
