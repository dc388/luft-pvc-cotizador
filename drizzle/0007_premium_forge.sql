CREATE TABLE `supplier_catalog_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text DEFAULT 'lista-precios' NOT NULL,
	`supplier` text NOT NULL,
	`brand` text NOT NULL,
	`file_name` text NOT NULL,
	`file_hash` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`file_modified_at` text DEFAULT '' NOT NULL,
	`revision` text NOT NULL,
	`effective_date` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`historical` integer DEFAULT 1 NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_sources_hash_idx` ON `supplier_catalog_sources` (`file_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_sources_revision_idx` ON `supplier_catalog_sources` (`supplier`,`source_type`,`revision`);--> statement-breakpoint
CREATE INDEX `supplier_sources_brand_idx` ON `supplier_catalog_sources` (`brand`,`supplier`);--> statement-breakpoint
CREATE TABLE `supplier_hardware_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier` text NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text DEFAULT '' NOT NULL,
	`file_hash` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`revision` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`extraction_status` text DEFAULT 'pendiente' NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`extracted_location` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_docs_hash_idx` ON `supplier_hardware_docs` (`supplier`,`file_hash`);--> statement-breakpoint
CREATE INDEX `supplier_docs_brand_idx` ON `supplier_hardware_docs` (`brand`,`supplier`);--> statement-breakpoint
CREATE TABLE `supplier_hardware_items` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier` text NOT NULL,
	`brand` text NOT NULL,
	`sku` text NOT NULL,
	`alt_key` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`presentation` text DEFAULT '' NOT NULL,
	`qty_per_presentation` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_items_sku_idx` ON `supplier_hardware_items` (`supplier`,`sku`);--> statement-breakpoint
CREATE INDEX `supplier_items_alt_idx` ON `supplier_hardware_items` (`supplier`,`alt_key`);--> statement-breakpoint
CREATE INDEX `supplier_items_brand_idx` ON `supplier_hardware_items` (`brand`,`supplier`);--> statement-breakpoint
CREATE TABLE `supplier_hardware_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`system` text NOT NULL,
	`wing_type` text DEFAULT '' NOT NULL,
	`size_condition` text DEFAULT '' NOT NULL,
	`supplier` text NOT NULL,
	`sku` text NOT NULL,
	`qty` text NOT NULL,
	`doc_id` text,
	`source_ref` text DEFAULT '' NOT NULL,
	`source_location` text DEFAULT '' NOT NULL,
	`verification` text DEFAULT 'tentativo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`doc_id`) REFERENCES `supplier_hardware_docs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_mappings_unique_idx` ON `supplier_hardware_mappings` (`brand`,`system`,`wing_type`,`size_condition`,`supplier`,`sku`);--> statement-breakpoint
CREATE INDEX `supplier_mappings_lookup_idx` ON `supplier_hardware_mappings` (`brand`,`system`,`verification`);--> statement-breakpoint
CREATE TABLE `supplier_hardware_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`source_id` text NOT NULL,
	`unit_price` text NOT NULL,
	`unit_price_minor` integer NOT NULL,
	`price_scale` integer DEFAULT 2 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`effective_date` text NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`source_row` integer DEFAULT 0 NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `supplier_hardware_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `supplier_catalog_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_prices_item_source_idx` ON `supplier_hardware_prices` (`item_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `supplier_prices_source_idx` ON `supplier_hardware_prices` (`source_id`);