import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const source = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Sawhorse",
  description:
    "A quoting desk for a one-person furniture shop. An open model reads the client note on this machine. The rate card sets every dollar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${source.variable} ${fraunces.variable} antialiased`}>
        <Shell>{children}</Shell>
        <Toaster />
      </body>
    </html>
  );
}
