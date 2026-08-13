ALTER TABLE `projects` ADD `origin` text DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `requester` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `currency` text DEFAULT 'MXN' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `pricing_list_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `estimated_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `created_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `imported_at` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `original_created_at` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `duplicated_from_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `schema_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `projects_deleted_created_idx` ON `projects` (`deleted_at`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_folio_idx` ON `projects` (`folio`) WHERE "projects"."folio" <> '';--> statement-breakpoint
ALTER TABLE `components` ADD `glass_index` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `components` ADD `typology` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `components` ADD `config_state` text DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE `components` ADD `unit_price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `components` ADD `total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `components_project_position_idx` ON `components` (`project_id`,`position`);--> statement-breakpoint
CREATE TABLE `quote_learning_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quote_learning_events_kind_created_idx` ON `quote_learning_events` (`kind`,`created_at`);--> statement-breakpoint
/* Relleno de los proyectos que ya estaban guardados.

   Una cotización que llegó del cotizador público entró desde fuera de esta pantalla, así que es
   un proyecto importado, y la fecha en que entró es su fecha de creación: no hubo otra. Los
   proyectos internos se quedan como "creados en la plataforma" por el valor por omisión de la
   columna, y sin fecha de importación, que es lo cierto.

   La ficha del solicitante NO se rellena aquí: se completa al leer, tomando el nombre de la
   columna `client` cuando el JSON viene vacío (ver readRequester en lib/projectRepo.ts). Hacerlo
   al leer y no con un UPDATE evita depender de las funciones JSON de SQLite y, sobre todo, deja
   una sola definición de "qué es una ficha de solicitante válida" en el código.

   El folio tampoco se inventa para los proyectos viejos: quedan con folio vacío, que el índice
   parcial de arriba permite, y el explorador los muestra como "Sin folio". Fabricarles un
   consecutivo los mezclaría con los folios reales del negocio. */
UPDATE `projects` SET `origin` = 'imported', `imported_at` = `created_at` WHERE `source` = 'web';
