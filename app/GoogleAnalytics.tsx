"use client";

import Script from "next/script";
import { useEffect } from "react";

const GA_MEASUREMENT_ID = "G-LR88J4FNE2";
const CROSS_DOMAIN_HOSTS = [
  "edison.pepepow.net",
  "game.pepepow.net",
  "pepepow-game-platform.edisonhuang.chatgpt.site",
  "pepepow-auto-battleground.edisonhuang.chatgpt.site",
];

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

export default function GoogleAnalytics() {
  useEffect(() => {
    const analyticsWindow = window as GtagWindow;
    analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
    analyticsWindow.gtag = analyticsWindow.gtag || ((...args: unknown[]) => {
      analyticsWindow.dataLayer?.push(args);
    });
    analyticsWindow.gtag("js", new Date());
    analyticsWindow.gtag("config", GA_MEASUREMENT_ID, {
      linker: { domains: CROSS_DOMAIN_HOSTS },
    });
  }, []);

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  );
}
