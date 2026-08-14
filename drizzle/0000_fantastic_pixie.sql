CREATE TABLE `game_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_name` text NOT NULL,
	`anonymous_session` text NOT NULL,
	`device` text NOT NULL,
	`round_reached` integer,
	`session_seconds` integer,
	`fps` integer,
	`created_at` integer NOT NULL
);
