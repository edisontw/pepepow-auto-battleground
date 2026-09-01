"use client";

export type AnalyticsEventName = "start" | "continue" | "game_over" | "round_reached" | "restart" | "session_end" | "fps_sample";

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

function trackGa4(name: AnalyticsEventName, payload: Record<string, string | number | boolean | null>) {
  const gtag = (window as GtagWindow).gtag;
  if (!gtag) return;
  if (name === "start" || name === "restart") {
    gtag("event", "game_start", {
      difficulty: payload.difficulty,
      start_type: name === "restart" ? "restart" : "new",
    });
  } else if (name === "continue") {
    gtag("event", "game_continue", { difficulty: payload.difficulty });
  } else if (name === "game_over") {
    gtag("event", "game_over", {
      result: payload.result,
      difficulty: payload.difficulty,
    });
  }
}

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
  trackGa4(name, payload);
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
