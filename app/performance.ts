"use client";

import { useEffect, useRef, useState } from "react";

export type PerformanceProfile = {
  quality: "low" | "balanced" | "high";
  targetFps: 30 | 60;
  measuredFps: number;
  device: "mobile" | "tablet" | "desktop";
  cores: number;
  memoryGb: number | null;
  reducedMotion: boolean;
};

function initialProfile(): PerformanceProfile {
  if (typeof window === "undefined") return { quality: "balanced", targetFps: 60, measuredFps: 60, device: "desktop", cores: 4, memoryGb: null, reducedMotion: false };
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = matchMedia("(max-width: 700px)").matches;
  const tablet = !mobile && matchMedia("(max-width: 1100px)").matches;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cores = nav.hardwareConcurrency || 4;
  const memoryGb = nav.deviceMemory ?? null;
  const constrained = reducedMotion || cores <= 4 || (memoryGb !== null && memoryGb <= 4);
  return {
    quality: constrained ? "low" : mobile || tablet ? "balanced" : "high",
    targetFps: constrained ? 30 : 60,
    measuredFps: 60,
    device: mobile ? "mobile" : tablet ? "tablet" : "desktop",
    cores,
    memoryGb,
    reducedMotion,
  };
}

export function useAdaptivePerformance() {
  const [profile, setProfile] = useState<PerformanceProfile>(initialProfile);
  const samples = useRef<number[]>([]);
  const last = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      if (last.current) {
        const delta = now - last.current;
        if (delta > 0 && delta < 250) samples.current.push(1000 / delta);
        if (samples.current.length >= 90) {
          const sorted = [...samples.current].sort((a, b) => a - b);
          const fps = Math.round(sorted[Math.floor(sorted.length * 0.4)] || 60);
          samples.current = [];
          setProfile((current) => {
            const shouldReduce = fps < 43;
            const canRaise = fps > 56 && current.cores > 4 && !current.reducedMotion;
            return {
              ...current,
              measuredFps: fps,
              targetFps: shouldReduce ? 30 : canRaise ? 60 : current.targetFps,
              quality: shouldReduce ? "low" : canRaise ? (current.device === "desktop" ? "high" : "balanced") : current.quality,
            };
          });
        }
      }
      last.current = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return profile;
}
