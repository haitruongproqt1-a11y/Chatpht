CREATE TABLE `friendships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pairKey` varchar(48) NOT NULL,
	`userOneId` int NOT NULL,
	`userTwoId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`),
	CONSTRAINT `friendships_pairKey_unique` UNIQUE(`pairKey`)
);
--> statement-breakpoint
CREATE INDEX `friendship_user_one_idx` ON `friendships` (`userOneId`);--> statement-breakpoint
CREATE INDEX `friendship_user_two_idx` ON `friendships` (`userTwoId`);