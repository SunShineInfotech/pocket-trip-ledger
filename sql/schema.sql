-- Pocket Trip Ledger MySQL schema (MySQL 8 / MariaDB 10.5+).
-- Run once against a new database. API credentials are configured separately.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `tbl_trip_family` (
  `family_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `family_name` VARCHAR(100) NOT NULL,
  `head_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `is_deleted` ENUM('0','1') NOT NULL DEFAULT '1',
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`family_id`),
  KEY `idx_trip_family_name` (`family_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_user` (
  `user_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `family_id` BIGINT UNSIGNED DEFAULT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `is_admin` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_deleted` ENUM('0','1') NOT NULL DEFAULT '1',
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_trip_user_mobile` (`mobile`),
  UNIQUE KEY `uq_trip_user_email` (`email`),
  KEY `idx_trip_user_family` (`family_id`),
  CONSTRAINT `fk_trip_user_family` FOREIGN KEY (`family_id`) REFERENCES `tbl_trip_family` (`family_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip` (
  `trip_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_name` VARCHAR(150) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE DEFAULT NULL,
  `admin_user_id` BIGINT UNSIGNED NOT NULL,
  `is_deleted` ENUM('0','1') NOT NULL DEFAULT '1',
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`trip_id`),
  KEY `idx_trip_admin` (`admin_user_id`,`is_deleted`),
  CONSTRAINT `fk_trip_admin` FOREIGN KEY (`admin_user_id`) REFERENCES `tbl_trip_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_family_member` (
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `family_id` BIGINT UNSIGNED NOT NULL,
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`trip_id`,`family_id`),
  CONSTRAINT `fk_trip_family_member_trip` FOREIGN KEY (`trip_id`) REFERENCES `tbl_trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trip_family_member_family` FOREIGN KEY (`family_id`) REFERENCES `tbl_trip_family` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_member` (
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `family_id` BIGINT UNSIGNED NOT NULL COMMENT 'Family snapshot for this trip; keeps historical settlements stable',
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`trip_id`,`user_id`),
  KEY `idx_trip_member_user` (`user_id`,`trip_id`),
  KEY `idx_trip_member_family` (`trip_id`,`family_id`),
  CONSTRAINT `fk_trip_member_trip` FOREIGN KEY (`trip_id`) REFERENCES `tbl_trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trip_member_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_trip_user` (`user_id`),
  CONSTRAINT `fk_trip_member_family` FOREIGN KEY (`family_id`) REFERENCES `tbl_trip_family` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_category` (
  `category_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED DEFAULT NULL,
  `category_name` VARCHAR(60) NOT NULL,
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `is_deleted` ENUM('0','1') NOT NULL DEFAULT '1',
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  KEY `idx_trip_category_trip` (`trip_id`,`is_deleted`),
  CONSTRAINT `fk_trip_category_trip` FOREIGN KEY (`trip_id`) REFERENCES `tbl_trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trip_category_creator` FOREIGN KEY (`created_by`) REFERENCES `tbl_trip_user` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_expense` (
  `expense_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `paid_by_user_id` BIGINT UNSIGNED NOT NULL,
  `expense_date` DATE NOT NULL,
  `remark` VARCHAR(500) DEFAULT NULL,
  `updated_flag` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `updated_by` BIGINT UNSIGNED DEFAULT NULL,
  `is_deleted` ENUM('0','1') NOT NULL DEFAULT '1',
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`expense_id`),
  KEY `idx_trip_expense_date` (`trip_id`,`is_deleted`,`expense_date`,`expense_id`),
  KEY `idx_trip_expense_category` (`category_id`),
  KEY `idx_trip_expense_payer` (`paid_by_user_id`),
  CONSTRAINT `fk_trip_expense_trip` FOREIGN KEY (`trip_id`) REFERENCES `tbl_trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trip_expense_category` FOREIGN KEY (`category_id`) REFERENCES `tbl_trip_category` (`category_id`),
  CONSTRAINT `fk_trip_expense_payer` FOREIGN KEY (`paid_by_user_id`) REFERENCES `tbl_trip_user` (`user_id`),
  CONSTRAINT `fk_trip_expense_creator` FOREIGN KEY (`created_by`) REFERENCES `tbl_trip_user` (`user_id`),
  CONSTRAINT `fk_trip_expense_updater` FOREIGN KEY (`updated_by`) REFERENCES `tbl_trip_user` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_expense_split` (
  `expense_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `share_amount` DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (`expense_id`,`user_id`),
  KEY `idx_trip_split_user` (`user_id`,`expense_id`),
  CONSTRAINT `fk_trip_split_expense` FOREIGN KEY (`expense_id`) REFERENCES `tbl_trip_expense` (`expense_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trip_split_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_trip_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_notification` (
  `notification_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED DEFAULT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `message` VARCHAR(250) NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_trip_notification_user` (`user_id`,`is_read`,`c_date`),
  CONSTRAINT `fk_trip_notification_trip` FOREIGN KEY (`trip_id`) REFERENCES `tbl_trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trip_notification_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_trip_user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_login_otp` (
  `otp_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `consumed_at` DATETIME DEFAULT NULL,
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`otp_id`),
  KEY `idx_trip_otp_user_expiry` (`user_id`,`expires_at`,`consumed_at`),
  CONSTRAINT `fk_trip_otp_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_trip_user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_trip_user_session` (
  `session_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `last_seen_at` DATETIME DEFAULT NULL,
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `uq_trip_session_token` (`token_hash`),
  KEY `idx_trip_session_user` (`user_id`,`expires_at`),
  CONSTRAINT `fk_trip_session_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_trip_user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared categories shown in the UI; trip-specific categories can be added later.
INSERT INTO `tbl_trip_category` (`trip_id`,`category_name`) SELECT NULL,'Food & dining' WHERE NOT EXISTS (SELECT 1 FROM `tbl_trip_category` WHERE `trip_id` IS NULL AND `category_name`='Food & dining' AND `is_deleted`='1');
INSERT INTO `tbl_trip_category` (`trip_id`,`category_name`) SELECT NULL,'Travel' WHERE NOT EXISTS (SELECT 1 FROM `tbl_trip_category` WHERE `trip_id` IS NULL AND `category_name`='Travel' AND `is_deleted`='1');
INSERT INTO `tbl_trip_category` (`trip_id`,`category_name`) SELECT NULL,'Stay' WHERE NOT EXISTS (SELECT 1 FROM `tbl_trip_category` WHERE `trip_id` IS NULL AND `category_name`='Stay' AND `is_deleted`='1');
INSERT INTO `tbl_trip_category` (`trip_id`,`category_name`) SELECT NULL,'Activities' WHERE NOT EXISTS (SELECT 1 FROM `tbl_trip_category` WHERE `trip_id` IS NULL AND `category_name`='Activities' AND `is_deleted`='1');
INSERT INTO `tbl_trip_category` (`trip_id`,`category_name`) SELECT NULL,'Fuel' WHERE NOT EXISTS (SELECT 1 FROM `tbl_trip_category` WHERE `trip_id` IS NULL AND `category_name`='Fuel' AND `is_deleted`='1');
INSERT INTO `tbl_trip_category` (`trip_id`,`category_name`) SELECT NULL,'Shopping' WHERE NOT EXISTS (SELECT 1 FROM `tbl_trip_category` WHERE `trip_id` IS NULL AND `category_name`='Shopping' AND `is_deleted`='1');
