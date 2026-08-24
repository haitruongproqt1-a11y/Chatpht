CREATE TABLE `message_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`deliveredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_delivery_unique` UNIQUE(`messageId`,`userId`)
);
