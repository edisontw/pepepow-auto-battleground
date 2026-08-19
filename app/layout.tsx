import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./v06-overrides.css";
import "./v07-overrides.css";
import "./v08-overrides.css";
import "./v08-fixes.css";
import "./v09-art.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PEPEPOW Auto Battleground",
  description: "PEPEPOW Auto Battleground v0.9.1 — 33 original units, 14 illustrated synergies, readable spell language, deterministic replays, and adaptive AI commanders.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/pepepow-symbol.png",
    shortcut: "/pepepow-symbol.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
