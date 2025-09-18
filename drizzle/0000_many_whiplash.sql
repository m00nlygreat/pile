CREATE TABLE `anon_users` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`display_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `board_members` (
	`board_id` text NOT NULL,
	`anon_user_id` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`board_id`, `anon_user_id`),
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`anon_user_id`) REFERENCES `anon_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`default_channel_id` text,
	`session_block_minutes` integer DEFAULT 60 NOT NULL,
	`session_anchor` text DEFAULT '00:00' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`default_channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_slug_unique` ON `boards` (`slug`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_channels_board` ON `channels` (`board_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `channels_board_slug_unique` ON `channels` (`board_id`,`slug`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`board_id` text NOT NULL,
	`anon_user_id` text,
	`type` text NOT NULL,
	`text_md` text,
	`file_path` text,
	`file_mime` text,
	`file_size` integer,
	`link_url` text,
	`link_title` text,
	`link_desc` text,
	`link_image` text,
	`session_start` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`anon_user_id`) REFERENCES `anon_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_items_board` ON `items` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_items_channel` ON `items` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_items_created` ON `items` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `idx_items_session` ON `items` (`session_start`);