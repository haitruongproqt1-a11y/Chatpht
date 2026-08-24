ALTER TABLE `friendships` ADD `requestedBy` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `friendships` ADD `status` enum('pending','accepted','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `friendships` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;