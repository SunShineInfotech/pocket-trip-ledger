-- Apply once to a database created with the earlier schema.sql.
-- New installations already include tbl_trip_member.family_id in schema.sql.
ALTER TABLE `tbl_trip_member`
  ADD COLUMN `family_id` BIGINT UNSIGNED NULL AFTER `user_id`;

UPDATE `tbl_trip_member` tm
JOIN `tbl_trip_user` u ON u.user_id = tm.user_id
SET tm.family_id = u.family_id;

-- Stop if this query returns rows: assign those users to a family before continuing.
SELECT tm.trip_id, tm.user_id
FROM `tbl_trip_member` tm
WHERE tm.family_id IS NULL;

ALTER TABLE `tbl_trip_member`
  MODIFY COLUMN `family_id` BIGINT UNSIGNED NOT NULL,
  ADD KEY `idx_trip_member_family` (`trip_id`,`family_id`),
  ADD CONSTRAINT `fk_trip_member_family`
    FOREIGN KEY (`family_id`) REFERENCES `tbl_trip_family` (`family_id`);
