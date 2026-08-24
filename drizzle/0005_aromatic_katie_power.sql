ALTER TABLE `messages` ADD `clientMessageId` varchar(80);--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `message_client_id_unique` UNIQUE(`roomId`,`senderId`,`clientMessageId`);