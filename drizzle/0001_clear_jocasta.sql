CREATE TABLE `call_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`callSessionId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`leftAt` timestamp,
	CONSTRAINT `call_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `call_participant_unique` UNIQUE(`callSessionId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `call_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`livekitRoom` varchar(160) NOT NULL,
	`createdBy` int NOT NULL,
	`status` enum('ringing','active','ended') NOT NULL DEFAULT 'ringing',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	CONSTRAINT `call_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `call_sessions_livekitRoom_unique` UNIQUE(`livekitRoom`)
);
--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('direct','group') NOT NULL DEFAULT 'group',
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`directKey` varchar(128),
	`ownerId` int NOT NULL,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_rooms_directKey_unique` UNIQUE(`directKey`)
);
--> statement-breakpoint
CREATE TABLE `message_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_read_unique` UNIQUE(`messageId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`senderId` int NOT NULL,
	`body` text NOT NULL,
	`kind` enum('text','image','video','file','system') NOT NULL DEFAULT 'text',
	`attachmentUrl` text,
	`attachmentName` varchar(255),
	`attachmentMimeType` varchar(160),
	`attachmentSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`editedAt` timestamp,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `room_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('member','admin') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `room_member_unique` UNIQUE(`roomId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `call_participant_user_idx` ON `call_participants` (`userId`);--> statement-breakpoint
CREATE INDEX `call_room_status_idx` ON `call_sessions` (`roomId`,`status`);--> statement-breakpoint
CREATE INDEX `message_room_created_idx` ON `messages` (`roomId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `room_member_user_idx` ON `room_members` (`userId`);