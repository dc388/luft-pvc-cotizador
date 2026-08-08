CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`designation` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`width_mm` integer DEFAULT 0 NOT NULL,
	`height_mm` integer DEFAULT 0 NOT NULL,
	`brand` text DEFAULT 'Aluplast' NOT NULL,
	`system_index` integer DEFAULT 0 NOT NULL,
	`color_index` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Proyecto sin nombre' NOT NULL,
	`active_component_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
