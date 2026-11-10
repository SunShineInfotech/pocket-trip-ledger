CREATE TABLE IF NOT EXISTS `tbl_trip_admin` (
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `c_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`trip_id`, `user_id`),
  CONSTRAINT `fk_trip_admin_member_trip` FOREIGN KEY (`trip_id`) REFERENCES `tbl_trip` (`trip_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trip_admin_member_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_trip_user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `tbl_trip_admin` (`trip_id`, `user_id`)
SELECT `trip_id`, `admin_user_id` FROM `tbl_trip`;
