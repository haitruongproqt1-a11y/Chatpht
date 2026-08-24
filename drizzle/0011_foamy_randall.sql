ALTER TABLE `call_sessions` RENAME COLUMN `livekitRoom` TO `p2pRoom`;--> statement-breakpoint
ALTER TABLE `call_sessions` DROP INDEX `call_sessions_livekitRoom_unique`;--> statement-breakpoint
ALTER TABLE `call_sessions` ADD CONSTRAINT `call_sessions_p2pRoom_unique` UNIQUE(`p2pRoom`);