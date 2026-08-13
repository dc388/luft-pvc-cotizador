CREATE TABLE `project_outcomes` (
	`project_id` text PRIMARY KEY NOT NULL,
	`quoted_total` integer DEFAULT 0 NOT NULL,
	`quoted_pieces` integer DEFAULT 0 NOT NULL,
	`actual_cost` integer DEFAULT 0 NOT NULL,
	`actual_revenue` integer DEFAULT 0 NOT NULL,
	`pieces_built` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`closed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT 'manual' NOT NULL,
	`component_count` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_versions_project_idx` ON `project_versions` (`project_id`,`created_at`);