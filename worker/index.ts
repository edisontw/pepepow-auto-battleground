/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const analyticsEvents = new Set(["start", "continue", "game_over", "round_reached", "restart", "session_end", "fps_sample"]);
let analyticsReady = false;

async function handleAnalytics(request: Request, env: Env) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await request.json() as { name?: string; sessionId?: string; device?: string; at?: number; payload?: Record<string, unknown> };
    if (!body.name || !analyticsEvents.has(body.name) || !body.sessionId || body.sessionId.length > 64) return Response.json({ ok: false }, { status: 400 });
    if (!analyticsReady) {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        anonymous_session TEXT NOT NULL,
        device TEXT NOT NULL,
        round_reached INTEGER,
        session_seconds INTEGER,
        fps INTEGER,
        created_at INTEGER NOT NULL
      )`).run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS game_events_created_at_idx ON game_events(created_at)").run();
      analyticsReady = true;
    }
    await env.DB.prepare("INSERT INTO game_events (event_name, anonymous_session, device, round_reached, session_seconds, fps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(body.name, body.sessionId, String(body.device || "unknown").slice(0, 16), Number(body.payload?.round) || null, Number(body.payload?.sessionSeconds) || null, Number(body.payload?.fps) || null, Number(body.at) || Date.now())
      .run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/analytics") return handleAnalytics(request, env);

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
