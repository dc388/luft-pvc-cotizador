CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone_key` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_key_idx` ON `customers` (`phone_key`);--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE TABLE `quote_events` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_events_quote_idx` ON `quote_events` (`quote_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`folio` text NOT NULL,
	`folio_year` integer NOT NULL,
	`folio_seq` integer NOT NULL,
	`token` text NOT NULL,
	`customer_id` text NOT NULL,
	`project_id` text,
	`project_name` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'generada' NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`piece_count` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_folio_idx` ON `quotes` (`folio`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_token_idx` ON `quotes` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_folio_seq_idx` ON `quotes` (`folio_year`,`folio_seq`);--> statement-breakpoint
CREATE INDEX `quotes_customer_idx` ON `quotes` (`customer_id`);--> statement-breakpoint
CREATE INDEX `quotes_created_idx` ON `quotes` (`created_at`);