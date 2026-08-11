CREATE TABLE `assistant_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`brief` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assistant_sessions_updated_idx` ON `assistant_sessions` (`updated_at`);