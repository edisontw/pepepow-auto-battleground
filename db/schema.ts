import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gameEvents = sqliteTable("game_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventName: text("event_name").notNull(),
  anonymousSession: text("anonymous_session").notNull(),
  device: text("device").notNull(),
  roundReached: integer("round_reached"),
  sessionSeconds: integer("session_seconds"),
  fps: integer("fps"),
  createdAt: integer("created_at").notNull(),
});
