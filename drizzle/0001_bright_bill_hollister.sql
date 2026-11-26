CREATE TABLE `coupon_shares` (
	`code` varchar(5) NOT NULL,
	`ownerUid` varchar(128) NOT NULL,
	`payload` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coupon_shares_code` PRIMARY KEY(`code`)
);
