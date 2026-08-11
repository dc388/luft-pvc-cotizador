ALTER TABLE `projects` ADD `source` text DEFAULT 'interno' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `folio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `client` text DEFAULT '' NOT NULL;