"use client";

export type AnalyticsEventName = "start" | "round_reached" | "restart" | "session_end" | "fps_sample";

const SESSION_KEY = "ppab-anon-session";

function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    const random = crypto.getRandomValues(new Uint32Array(2));
    id = `anon-${random[0].toString(36)}-${random[1].toString(36)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function trackAnonymous(name: AnalyticsEventName, payload: Record<string, string | number | boolean | null> = {}, useBeacon = false) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    name,
    sessionId: sessionId(),
    at: Date.now(),
    device: matchMedia("(max-width: 700px)").matches ? "mobile" : matchMedia("(max-width: 1100px)").matches ? "tablet" : "desktop",
    payload,
  });
  if (useBeacon && navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
  else void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}
