import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "./v06-overrides.css";
import "./v07-overrides.css";
import "./v08-overrides.css";
import "./v08-fixes.css";
import "./v09-art.css";

const GA_MEASUREMENT_ID = "G-LR88J4FNE2";

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
  description: "PEPEPOW Auto Battleground v0.9.4 — clearer desktop and mobile combat UI, tap-to-swap controls, deterministic replays, and adaptive AI commanders.",
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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = window.gtag || gtag;
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              linker: {
                domains: [
                  'edison.pepepow.net',
                  'game.pepepow.net',
                  'pepepow-game-platform.edisonhuang.chatgpt.site',
                  'pepepow-auto-battleground.edisonhuang.chatgpt.site'
                ]
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}
