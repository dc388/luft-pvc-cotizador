CREATE TABLE `rate_limit_hits` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_hits_bucket_created_idx` ON `rate_limit_hits` (`bucket`,`created_at`);--> statement-breakpoint
CREATE INDEX `rate_limit_hits_created_idx` ON `rate_limit_hits` (`created_at`);